import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Redis } from 'ioredis';

@Injectable()
export class BlacklistService {
  private BLACKLISTED = 'blacklisted';
  private USER_INVALID_BEFORE_PREFIX = 'blacklisted:user:';

  client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisURL = this.configService.get('REDIS_URL');
    this.client = new Redis(redisURL);
  }

  async blacklistToken(jwt: string) {
    await this.client.set(jwt, this.BLACKLISTED, 'EX', this.getJwtExpirationSeconds());
  }

  /*
   * Invalidates every access token issued to a user before current date by storing a cutoff timestamp in Redis.
   * The cutoff timestamp only needs to be stored as long as the token with the longest expiration time
   */
  async blacklistPreviousUserTokens(userId: number) {
    const issuedBefore = Math.floor(Date.now() / 1000);
    await this.client.set(
      this.getUserInvalidationKey(userId),
      String(issuedBefore),
      'EX',
      this.getJwtExpirationSeconds(),
    );
  }

  async isTokenBlacklisted(jwt: string) {
    const data = await this.client.get(jwt);
    if (data === this.BLACKLISTED) {
      return true;
    }

    const payload = this.decodePayload(jwt);
    if (!payload?.userId || typeof payload.iat !== 'number') {
      return false;
    }

    const cutoffTimestampStr = await this.client.get(this.getUserInvalidationKey(payload.userId));
    if (cutoffTimestampStr === null) {
      return false;
    }

    const cutoffTimestamp = Number(cutoffTimestampStr);
    if (!Number.isFinite(cutoffTimestamp)) {
      return true;
    }

    return payload.iat <= cutoffTimestamp;
  }

  private getJwtExpirationSeconds(): number {
    const expirationDays = this.configService.get<number>('JWT_EXPIRATION');
    return Number(expirationDays) * 24 * 60 * 60;
  }

  private getUserInvalidationKey(userId: number): string {
    return `${this.USER_INVALID_BEFORE_PREFIX}${userId}`;
  }

  private decodePayload(jwt: string): { userId?: number; iat?: number } | null {
    try {
      const payload = jwt.split('.')[1];
      if (!payload) return null;
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
  }
}
