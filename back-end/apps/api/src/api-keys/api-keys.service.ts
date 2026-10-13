import { randomBytes, createHash, timingSafeEqual } from 'crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';

import { ApiKey, ApiKeyEvent, ApiKeyEventType, ApiKeyRevokedReason, User } from '@entities';

import { NatsPublisherService } from '@app/common';
import { emitApiKeyRevokedEmail, isEligibleForReportAccess } from '@app/common';

const KEY_ID_BYTES = 12;
const SECRET_BYTES = 32;
const KEY_PREFIX = 'tt';
// keyId is fixed-length hex, so it can never contain the '_' delimiter - safe
// to split on even though the base64url secret itself may legally contain '_'.
const KEY_PATTERN = /^tt_([0-9a-f]{24})_(.+)$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LAST_USED_UPDATE_THROTTLE_MS = 60 * 60 * 1000;

// Notifying on these would be moot/unwanted: USER_REMOVED means the account
// (and its email relationship) is already being torn down, and USER means the
// user revoked their own key, so they already know.
const NON_NOTIFIED_REVOKE_REASONS = new Set<ApiKeyRevokedReason>([
  ApiKeyRevokedReason.USER_REMOVED,
  ApiKeyRevokedReason.USER,
]);

export interface ApiKeyReveal {
  key: string;
  keyId: string;
  createdAt: Date;
}

export interface ApiKeyStatus {
  hasKey: boolean;
  keyId: string | null;
  createdAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  revokedReason: ApiKeyRevokedReason | null;
  idleExpiryDays: number;
}

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey) private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(ApiKeyEvent) private readonly apiKeyEventRepo: Repository<ApiKeyEvent>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notificationsPublisher: NatsPublisherService,
    private readonly configService: ConfigService,
  ) {}

  async create(user: User): Promise<ApiKeyReveal> {
    this.assertEligible(user);

    const existing = await this.apiKeyRepo.findOne({ where: { userId: user.id } });
    if (existing && !existing.revokedAt) {
      throw new ConflictException('A key already exists for this user - use regenerate instead.');
    }

    try {
      return await this.issueKey(user.id, user.id, ApiKeyEventType.CREATED, existing ?? undefined);
    } catch (err) {
      // Two concurrent creates for a never-before-keyed user can both pass the
      // check above and race on userId's unique constraint - map that to the
      // same ConflictException the check above throws, instead of a raw 500.
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException('A key already exists for this user - use regenerate instead.');
      }
      throw err;
    }
  }

  async regenerate(user: User): Promise<ApiKeyReveal> {
    this.assertEligible(user);

    const existing = await this.apiKeyRepo.findOne({ where: { userId: user.id } });
    if (!existing) {
      throw new NotFoundException('No key exists for this user yet - create one first.');
    }

    return this.issueKey(user.id, user.id, ApiKeyEventType.REGENERATED, existing);
  }

  // Idempotent - revoking an already-revoked (or nonexistent) key is a no-op,
  // so callers (the permission-removal cascade, the inactivity auto-revoke in
  // validateApiKey) don't need to check state first. The UPDATE itself is the
  // atomic claim (same pattern as revokeStaleKeys()): it's guarded by
  // "revokedAt IS NULL", so if two callers race to revoke the same key for
  // different reasons, only the one whose UPDATE lands first actually revokes
  // it and sends the email - the loser's UPDATE affects zero rows and returns
  // early.
  async revoke(
    userId: number,
    reason: ApiKeyRevokedReason,
    performedByUserId: number | null,
  ): Promise<void> {
    const claimedId = await this.dataSource.transaction(async manager => {
      const result = await manager
        .createQueryBuilder()
        .update(ApiKey)
        .set({ revokedAt: new Date(), revokedReason: reason })
        .where('"userId" = :userId', { userId })
        .andWhere('"revokedAt" IS NULL')
        .returning(['id'])
        .execute();
      const rows = result.raw as { id: number }[];
      if (rows.length === 0) return null;

      const event = manager.create(ApiKeyEvent, {
        apiKeyId: rows[0].id,
        userId,
        performedBy: performedByUserId,
        eventType: ApiKeyEventType.REVOKED,
        reason,
      });
      await manager.save(event);

      return rows[0].id;
    });
    if (claimedId === null) return;

    if (!NON_NOTIFIED_REVOKE_REASONS.has(reason)) {
      const apiKey = await this.apiKeyRepo.findOne({
        where: { id: claimedId },
        relations: { user: true },
      });
      const additionalData: Record<string, unknown> = { reason };
      if (reason === ApiKeyRevokedReason.INACTIVITY) {
        additionalData.idleExpiryDays = this.idleExpiryDays();
      }
      await emitApiKeyRevokedEmail(this.notificationsPublisher, [
        { email: apiKey!.user.email, additionalData },
      ]);
    }
  }

  // The sole place staleness is decided - validateApiKey() only checks revokedAt
  // (see comment there), so idleExpiryDays is enforced here, at most one sweep
  // interval late, rather than exactly. In exchange, revokedAt/the status endpoint/
  // the revoked email always agree with what validateApiKey() is actually doing.
  // The claiming UPDATE is a single atomic statement guarded by "revokedAt IS NULL",
  // so concurrent instances racing this same job can't double-revoke or double-email
  // a row - whichever instance's UPDATE lands first is the only one that affects it.
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'api-key-stale-sweep' })
  async revokeStaleKeys(): Promise<void> {
    const cutoff = new Date(Date.now() - this.idleExpiryDays() * MS_PER_DAY);

    const claimed = await this.dataSource.transaction(async manager => {
      const result = await manager
        .createQueryBuilder()
        .update(ApiKey)
        .set({ revokedAt: new Date(), revokedReason: ApiKeyRevokedReason.INACTIVITY })
        .where('"revokedAt" IS NULL')
        .andWhere('COALESCE("lastUsedAt", "createdAt") < :cutoff', { cutoff })
        .returning(['id', 'userId'])
        .execute();
      const rows = result.raw as { id: number; userId: number }[];
      if (rows.length === 0) return rows;

      const events = rows.map(row =>
        manager.create(ApiKeyEvent, {
          apiKeyId: row.id,
          userId: row.userId,
          performedBy: null,
          eventType: ApiKeyEventType.REVOKED,
          reason: ApiKeyRevokedReason.INACTIVITY,
        }),
      );
      await manager.save(events);

      return rows;
    });
    if (claimed.length === 0) return;

    const apiKeys = await this.apiKeyRepo.find({
      where: { id: In(claimed.map(row => row.id)) },
      relations: { user: true },
    });
    const idleExpiryDays = this.idleExpiryDays();
    await emitApiKeyRevokedEmail(
      this.notificationsPublisher,
      apiKeys.map(apiKey => ({
        email: apiKey.user.email,
        additionalData: { reason: ApiKeyRevokedReason.INACTIVITY, idleExpiryDays },
      })),
    );
  }

  async getStatus(userId: number): Promise<ApiKeyStatus> {
    const apiKey = await this.apiKeyRepo.findOne({ where: { userId } });
    return this.toStatus(apiKey);
  }

  // Batched form of getStatus, for admin-facing listings - one query for all
  // requested users instead of N+1. Returns a status (hasKey: false if none)
  // for every id in userIds.
  async getStatuses(userIds: number[]): Promise<Map<number, ApiKeyStatus>> {
    const statuses = new Map<number, ApiKeyStatus>();
    if (userIds.length === 0) return statuses;

    const apiKeys = await this.apiKeyRepo.find({ where: { userId: In(userIds) } });
    const byUserId = new Map(apiKeys.map(apiKey => [apiKey.userId, apiKey]));

    for (const userId of userIds) {
      statuses.set(userId, this.toStatus(byUserId.get(userId) ?? null));
    }

    return statuses;
  }

  private toStatus(apiKey: ApiKey | null): ApiKeyStatus {
    return {
      hasKey: !!apiKey,
      keyId: apiKey?.keyId ?? null,
      createdAt: apiKey?.createdAt ?? null,
      lastUsedAt: apiKey?.lastUsedAt ?? null,
      revokedAt: apiKey?.revokedAt ?? null,
      revokedReason: apiKey?.revokedReason ?? null,
      idleExpiryDays: this.idleExpiryDays(),
    };
  }

  // Used by JwtOrApiKeyGuard. Returns the resolved owner, re-checked live
  // against the DB on every call - never trust eligibility baked into the key
  // itself, same principle as the JWT path never trusting claims in the token.
  async validateApiKey(presentedKey: string, clientIp?: string): Promise<User | null> {
    const match = KEY_PATTERN.exec(presentedKey);
    if (!match) return null;
    const [, keyId, secret] = match;

    const apiKey = await this.apiKeyRepo.findOne({ where: { keyId }, relations: { user: true } });
    if (!apiKey) return null;

    if (!this.secretMatches(secret, apiKey.secretHash)) {
      await this.recordAuthFailure(apiKey, clientIp);
      return null;
    }

    // Staleness isn't checked here - revokeStaleKeys() is the single source of
    // truth for that, so revokedAt, the status endpoint, and the revoked email
    // always agree. A key merely past idleExpiryDays but not yet swept still
    // authenticates; see revokeStaleKeys() for the actual cutoff.
    if (apiKey.revokedAt) return null;

    if (!isEligibleForReportAccess(apiKey.user)) return null;

    await this.touchLastUsed(apiKey, clientIp);

    return apiKey.user;
  }

  private async issueKey(
    userId: number,
    performedByUserId: number,
    eventType: ApiKeyEventType.CREATED | ApiKeyEventType.REGENERATED,
    existing?: ApiKey,
  ): Promise<ApiKeyReveal> {
    const keyId = randomBytes(KEY_ID_BYTES).toString('hex');
    const secret = randomBytes(SECRET_BYTES).toString('base64url');
    const secretHash = this.hashSecret(secret);
    const createdAt = new Date();

    await this.dataSource.transaction(async manager => {
      const row = existing ?? manager.create(ApiKey, { userId });
      row.keyId = keyId;
      row.secretHash = secretHash;
      // Explicitly reassigned even on regenerate (an update, not an insert) so
      // "created" reflects when THIS key version was issued, not when the row
      // was first inserted - otherwise a regenerated key's idle clock would
      // measure from the original row's creation instead of restarting.
      row.createdAt = createdAt;
      row.lastUsedAt = null;
      row.lastUsedIp = null;
      row.revokedAt = null;
      row.revokedReason = null;
      const saved = await manager.save(row);

      const event = manager.create(ApiKeyEvent, {
        apiKeyId: saved.id,
        userId,
        performedBy: performedByUserId,
        eventType,
      });
      await manager.save(event);
    });

    return { key: `${KEY_PREFIX}_${keyId}_${secret}`, keyId, createdAt };
  }

  private assertEligible(user: User): void {
    if (!isEligibleForReportAccess(user)) {
      throw new ForbiddenException('Not eligible for a report API key.');
    }
  }

  private secretMatches(presentedSecret: string, storedHash: string): boolean {
    const presentedBuf = Buffer.from(this.hashSecret(presentedSecret), 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (presentedBuf.length !== storedBuf.length) return false;
    return timingSafeEqual(presentedBuf, storedBuf);
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private idleExpiryDays(): number {
    return this.configService.get<number>('API_KEY_IDLE_EXPIRY_DAYS')!;
  }

  private async touchLastUsed(apiKey: ApiKey, clientIp?: string): Promise<void> {
    const now = Date.now();
    if (apiKey.lastUsedAt && now - apiKey.lastUsedAt.getTime() < LAST_USED_UPDATE_THROTTLE_MS) {
      return;
    }
    await this.apiKeyRepo.update(apiKey.id, {
      lastUsedAt: new Date(now),
      lastUsedIp: clientIp ?? null,
    });
  }

  private async recordAuthFailure(apiKey: ApiKey, clientIp?: string): Promise<void> {
    await this.apiKeyEventRepo.save(
      this.apiKeyEventRepo.create({
        apiKeyId: apiKey.id,
        userId: apiKey.userId,
        performedBy: null,
        eventType: ApiKeyEventType.AUTH_FAILED,
        ipAddress: clientIp ?? null,
      }),
    );
  }
}
