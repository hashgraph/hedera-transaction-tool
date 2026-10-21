import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import { mock, mockDeep } from 'jest-mock-extended';

import { ApiKey, ApiKeyEvent, ApiKeyEventType, ApiKeyRevokedReason, User } from '@entities';
import { NatsPublisherService } from '@app/common';

import { ApiKeysService } from './api-keys.service';

describe('ApiKeysService', () => {
  let service: ApiKeysService;

  const apiKeyRepo = mockDeep<Repository<ApiKey>>();
  const apiKeyEventRepo = mockDeep<Repository<ApiKeyEvent>>();
  const dataSource = mockDeep<DataSource>();
  const notificationsPublisher = mock<NatsPublisherService>();
  const configService = {
    get: jest.fn(),
  } as unknown as jest.Mocked<ConfigService>;

  const user: Partial<User> = {
    id: 1,
    admin: false,
    canViewReports: true,
  };

  const mockTransaction = () => {
    const transactionMock = jest.fn(async passedFunction => {
      return passedFunction(dataSource.manager);
    });
    dataSource.transaction.mockImplementation(transactionMock);
  };

  // Used by create()/regenerate() tests that reissue onto an existing row - that
  // path goes through a guarded UPDATE (createQueryBuilder), not manager.save().
  const buildIssueQueryBuilder = (result: { affected: number }) => {
    const qb: any = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(result),
    };
    dataSource.manager.createQueryBuilder.mockReturnValue(qb);
    return qb;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: getRepositoryToken(ApiKey), useValue: apiKeyRepo },
        { provide: getRepositoryToken(ApiKeyEvent), useValue: apiKeyEventRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: NatsPublisherService, useValue: notificationsPublisher },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);

    jest.resetAllMocks();
    configService.get.mockReturnValue(180);
    mockTransaction();
    dataSource.manager.create.mockImplementation((_entity, data) => data as any);
    dataSource.manager.save.mockImplementation(async entity => entity as any);
  });

  describe('create', () => {
    it('throws ForbiddenException for a user ineligible for a report API key', async () => {
      const ineligibleUser = { id: 1, admin: false, canViewReports: false } as User;

      await expect(service.create(ineligibleUser)).rejects.toThrow(ForbiddenException);
      expect(apiKeyRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a live key already exists', async () => {
      apiKeyRepo.findOne.mockResolvedValue({ id: 1, userId: 1, revokedAt: null } as ApiKey);

      await expect(service.create(user as User)).rejects.toThrow(ConflictException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('reissues a key when the existing one was revoked', async () => {
      const revokedKey = {
        id: 1,
        userId: 1,
        keyId: 'old-key-id',
        secretHash: 'old-hash',
        revokedAt: new Date('2026-01-01'),
        revokedReason: ApiKeyRevokedReason.PERMISSION_REMOVED,
      } as ApiKey;
      apiKeyRepo.findOne.mockResolvedValue(revokedKey);
      const qb = buildIssueQueryBuilder({ affected: 1 });

      const result = await service.create(user as User);

      expect(result.key).toMatch(/^tt_[0-9a-f]{24}_.+$/);
      expect(qb.where).toHaveBeenCalledWith('id = :id', { id: 1 });
      expect(qb.andWhere).toHaveBeenCalledWith('"keyId" = :oldKeyId', { oldKeyId: 'old-key-id' });
      expect(qb.set).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: null, revokedReason: null }),
      );
      expect(dataSource.manager.create).toHaveBeenCalledWith(
        ApiKeyEvent,
        expect.objectContaining({ apiKeyId: 1, eventType: ApiKeyEventType.CREATED }),
      );
    });

    it('throws ConflictException when a concurrent issuance already replaced the revoked row', async () => {
      const revokedKey = {
        id: 1,
        userId: 1,
        keyId: 'old-key-id',
        secretHash: 'old-hash',
        revokedAt: new Date('2026-01-01'),
        revokedReason: ApiKeyRevokedReason.PERMISSION_REMOVED,
      } as ApiKey;
      apiKeyRepo.findOne.mockResolvedValue(revokedKey);
      buildIssueQueryBuilder({ affected: 0 });

      await expect(service.create(user as User)).rejects.toThrow(ConflictException);
    });

    it('creates a key when none exists yet', async () => {
      apiKeyRepo.findOne.mockResolvedValue(null);

      const result = await service.create(user as User);

      expect(result.key).toMatch(/^tt_[0-9a-f]{24}_.+$/);
      expect(dataSource.manager.create).toHaveBeenCalledWith(
        ApiKey,
        expect.objectContaining({ userId: 1 }),
      );
    });

    it('maps a concurrent insert racing past the existence check to ConflictException', async () => {
      apiKeyRepo.findOne.mockResolvedValue(null);
      const queryFailedError = Object.assign(
        Object.create(QueryFailedError.prototype),
        { code: '23505' },
      );
      dataSource.manager.save.mockRejectedValueOnce(queryFailedError);

      await expect(service.create(user as User)).rejects.toThrow(ConflictException);
    });

    it('rethrows other database errors from a concurrent insert unchanged', async () => {
      apiKeyRepo.findOne.mockResolvedValue(null);
      const otherError = new Error('connection lost');
      dataSource.manager.save.mockRejectedValueOnce(otherError);

      await expect(service.create(user as User)).rejects.toThrow(otherError);
    });
  });

  describe('regenerate', () => {
    it('throws ForbiddenException for a user ineligible for a report API key', async () => {
      const ineligibleUser = { id: 1, admin: false, canViewReports: false } as User;

      await expect(service.regenerate(ineligibleUser)).rejects.toThrow(ForbiddenException);
      expect(apiKeyRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no key exists yet', async () => {
      apiKeyRepo.findOne.mockResolvedValue(null);

      await expect(service.regenerate(user as User)).rejects.toThrow(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('reissues the existing key, invalidating the previous one', async () => {
      const existing = {
        id: 1,
        userId: 1,
        keyId: 'old-key-id',
        secretHash: 'old-hash',
        createdAt: new Date('2025-01-01'),
        lastUsedAt: new Date('2025-06-01'),
        lastUsedIp: '1.2.3.4',
        revokedAt: null,
        revokedReason: null,
      } as ApiKey;
      apiKeyRepo.findOne.mockResolvedValue(existing);
      const qb = buildIssueQueryBuilder({ affected: 1 });

      const result = await service.regenerate(user as User);

      expect(result.key).toMatch(/^tt_[0-9a-f]{24}_.+$/);
      expect(result.keyId).not.toBe('old-key-id');
      expect(qb.where).toHaveBeenCalledWith('id = :id', { id: 1 });
      expect(qb.andWhere).toHaveBeenCalledWith('"keyId" = :oldKeyId', { oldKeyId: 'old-key-id' });
      expect(qb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastUsedAt: null,
          lastUsedIp: null,
          revokedAt: null,
          revokedReason: null,
        }),
      );
      expect(dataSource.manager.create).toHaveBeenCalledWith(
        ApiKeyEvent,
        expect.objectContaining({ apiKeyId: 1, eventType: ApiKeyEventType.REGENERATED }),
      );
    });

    it('throws ConflictException when two concurrent regenerate calls race', async () => {
      const existing = {
        id: 1,
        userId: 1,
        keyId: 'old-key-id',
        secretHash: 'old-hash',
        createdAt: new Date('2025-01-01'),
        lastUsedAt: new Date('2025-06-01'),
        lastUsedIp: '1.2.3.4',
        revokedAt: null,
        revokedReason: null,
      } as ApiKey;
      apiKeyRepo.findOne.mockResolvedValue(existing);
      buildIssueQueryBuilder({ affected: 0 });

      await expect(service.regenerate(user as User)).rejects.toThrow(ConflictException);
    });
  });

  describe('revoke', () => {
    const buildQueryBuilder = (raw: { id: number }[]) => {
      const qb: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw }),
      };
      dataSource.manager.createQueryBuilder.mockReturnValue(qb);
      return qb;
    };

    it('does nothing when no key exists for the user', async () => {
      buildQueryBuilder([]);

      await service.revoke(1, ApiKeyRevokedReason.USER, 1);

      expect(dataSource.manager.save).not.toHaveBeenCalled();
      expect(apiKeyRepo.findOne).not.toHaveBeenCalled();
      expect(notificationsPublisher.publish).not.toHaveBeenCalled();
    });

    it('does nothing when the key is already revoked - the guarded UPDATE claims zero rows', async () => {
      buildQueryBuilder([]);

      await service.revoke(1, ApiKeyRevokedReason.INACTIVITY, null);

      expect(dataSource.manager.save).not.toHaveBeenCalled();
      expect(notificationsPublisher.publish).not.toHaveBeenCalled();
    });

    it('revokes a live key and logs a REVOKED event', async () => {
      const qb = buildQueryBuilder([{ id: 1 }]);

      await service.revoke(1, ApiKeyRevokedReason.USER, 99);

      expect(qb.where).toHaveBeenCalledWith('"userId" = :userId', { userId: 1 });
      expect(qb.andWhere).toHaveBeenCalledWith('"revokedAt" IS NULL');
      expect(qb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          revokedAt: expect.any(Date),
          revokedReason: ApiKeyRevokedReason.USER,
        }),
      );
      expect(dataSource.manager.create).toHaveBeenCalledWith(
        ApiKeyEvent,
        expect.objectContaining({
          apiKeyId: 1,
          userId: 1,
          performedBy: 99,
          eventType: ApiKeyEventType.REVOKED,
          reason: ApiKeyRevokedReason.USER,
        }),
      );
      expect(dataSource.manager.save).toHaveBeenCalled();
    });

    it('emails the owner, including idleExpiryDays, when revoked for inactivity', async () => {
      buildQueryBuilder([{ id: 1 }]);
      apiKeyRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        user: { email: 'owner@example.com' },
      } as ApiKey);

      await service.revoke(1, ApiKeyRevokedReason.INACTIVITY, null);

      expect(apiKeyRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { user: true },
      });
      expect(notificationsPublisher.publish).toHaveBeenCalledWith(
        'notifications.queue.email.api-key-revoked',
        [
          {
            email: 'owner@example.com',
            additionalData: { reason: ApiKeyRevokedReason.INACTIVITY, idleExpiryDays: 180 },
          },
        ],
      );
    });

    it('emails the owner without idleExpiryDays when revoked for a non-inactivity reason', async () => {
      buildQueryBuilder([{ id: 1 }]);
      apiKeyRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        user: { email: 'owner@example.com' },
      } as ApiKey);

      await service.revoke(1, ApiKeyRevokedReason.PERMISSION_REMOVED, 99);

      expect(notificationsPublisher.publish).toHaveBeenCalledWith(
        'notifications.queue.email.api-key-revoked',
        [{ email: 'owner@example.com', additionalData: { reason: ApiKeyRevokedReason.PERMISSION_REMOVED } }],
      );
    });

    it.each([ApiKeyRevokedReason.USER, ApiKeyRevokedReason.USER_REMOVED])(
      'does not email the owner when revoked for reason %s',
      async reason => {
        buildQueryBuilder([{ id: 1 }]);

        await service.revoke(1, reason, 1);

        expect(notificationsPublisher.publish).not.toHaveBeenCalled();
        expect(apiKeyRepo.findOne).not.toHaveBeenCalled();
      },
    );
  });

  describe('getStatus', () => {
    it('returns hasKey: false when the user has no key', async () => {
      apiKeyRepo.findOne.mockResolvedValue(null);

      const result = await service.getStatus(1);

      expect(result).toEqual({
        hasKey: false,
        keyId: null,
        createdAt: null,
        lastUsedAt: null,
        revokedAt: null,
        revokedReason: null,
        idleExpiryDays: 180,
      });
    });

    it("returns the key's details when one exists", async () => {
      const createdAt = new Date('2025-01-01');
      const lastUsedAt = new Date('2025-02-01');
      apiKeyRepo.findOne.mockResolvedValue({
        keyId: 'abc',
        createdAt,
        lastUsedAt,
        revokedAt: null,
        revokedReason: null,
      } as ApiKey);

      const result = await service.getStatus(1);

      expect(result).toEqual({
        hasKey: true,
        keyId: 'abc',
        createdAt,
        lastUsedAt,
        revokedAt: null,
        revokedReason: null,
        idleExpiryDays: 180,
      });
    });
  });

  describe('getStatuses', () => {
    it('returns an empty map without querying when given no user ids', async () => {
      const result = await service.getStatuses([]);

      expect(result.size).toBe(0);
      expect(apiKeyRepo.find).not.toHaveBeenCalled();
    });

    it('returns a status for every requested id, hasKey: false for those without a key', async () => {
      apiKeyRepo.find.mockResolvedValue([
        { userId: 1, keyId: 'abc', createdAt: new Date(), lastUsedAt: null, revokedAt: null, revokedReason: null } as ApiKey,
      ]);

      const result = await service.getStatuses([1, 2]);

      expect(result.get(1)).toMatchObject({ hasKey: true, keyId: 'abc' });
      expect(result.get(2)).toMatchObject({ hasKey: false, keyId: null });
    });
  });

  describe('validateApiKey', () => {
    it('returns null for a key that does not match the expected format', async () => {
      const result = await service.validateApiKey('not-a-valid-key');

      expect(result).toBeNull();
      expect(apiKeyRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns null when no key with the given keyId exists', async () => {
      apiKeyRepo.findOne.mockResolvedValue(null);

      const result = await service.validateApiKey(`tt_${'a'.repeat(24)}_secret`);

      expect(result).toBeNull();
    });

    it('records an auth failure and returns null when the secret does not match', async () => {
      const apiKey = {
        id: 1,
        userId: 1,
        keyId: 'a'.repeat(24),
        secretHash: 'deadbeef',
        revokedAt: null,
        user: { admin: false, canViewReports: true },
      } as unknown as ApiKey;
      apiKeyRepo.findOne.mockResolvedValue(apiKey);

      const result = await service.validateApiKey(`tt_${apiKey.keyId}_wrong-secret`, '9.9.9.9');

      expect(result).toBeNull();
      expect(apiKeyEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKeyId: 1,
          userId: 1,
          performedBy: null,
          eventType: ApiKeyEventType.AUTH_FAILED,
          ipAddress: '9.9.9.9',
        }),
      );
      expect(apiKeyEventRepo.save).toHaveBeenCalled();
      expect(apiKeyRepo.update).not.toHaveBeenCalled();
    });

    it('returns null and audits an auth failure when the user is neither admin nor report-eligible', async () => {
      const apiKey = {
        id: 1,
        userId: 1,
        keyId: 'a'.repeat(24),
        secretHash: '',
        lastUsedAt: null,
        revokedAt: null,
        user: { admin: false, canViewReports: false },
      } as unknown as ApiKey;
      apiKeyRepo.findOne.mockResolvedValue(apiKey);
      jest.spyOn(service as any, 'secretMatches').mockReturnValue(true);

      const result = await service.validateApiKey(`tt_${apiKey.keyId}_secret`, '9.9.9.9');

      expect(result).toBeNull();
      expect(apiKeyRepo.update).not.toHaveBeenCalled();
      expect(apiKeyEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKeyId: 1,
          userId: 1,
          performedBy: null,
          eventType: ApiKeyEventType.AUTH_FAILED,
          ipAddress: '9.9.9.9',
        }),
      );
      expect(apiKeyEventRepo.save).toHaveBeenCalled();
    });

    it('still authenticates a key idle past idleExpiryDays but not yet swept', async () => {
      const apiKey = {
        id: 1,
        userId: 1,
        keyId: 'a'.repeat(24),
        secretHash: '',
        createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
        lastUsedAt: null,
        revokedAt: null,
        user: { admin: false, canViewReports: true },
      } as unknown as ApiKey;
      apiKeyRepo.findOne.mockResolvedValue(apiKey);
      jest.spyOn(service as any, 'secretMatches').mockReturnValue(true);

      const result = await service.validateApiKey(`tt_${apiKey.keyId}_secret`);

      expect(result).toBe(apiKey.user);
    });

    it('rejects a key already revoked (e.g. by the stale sweep) and audits an auth failure', async () => {
      const apiKey = {
        id: 1,
        userId: 1,
        keyId: 'a'.repeat(24),
        secretHash: '',
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: new Date(),
        revokedReason: ApiKeyRevokedReason.INACTIVITY,
        user: { admin: false, canViewReports: true },
      } as unknown as ApiKey;
      apiKeyRepo.findOne.mockResolvedValue(apiKey);
      jest.spyOn(service as any, 'secretMatches').mockReturnValue(true);

      const result = await service.validateApiKey(`tt_${apiKey.keyId}_secret`, '9.9.9.9');

      expect(result).toBeNull();
      expect(apiKeyRepo.update).not.toHaveBeenCalled();
      expect(apiKeyEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKeyId: 1,
          userId: 1,
          performedBy: null,
          eventType: ApiKeyEventType.AUTH_FAILED,
          ipAddress: '9.9.9.9',
        }),
      );
      expect(apiKeyEventRepo.save).toHaveBeenCalled();
    });

    it('touches lastUsedAt/lastUsedIp on first use', async () => {
      const apiKey = {
        id: 1,
        userId: 1,
        keyId: 'a'.repeat(24),
        secretHash: '',
        lastUsedAt: null,
        revokedAt: null,
        user: { admin: false, canViewReports: true },
      } as unknown as ApiKey;
      apiKeyRepo.findOne.mockResolvedValue(apiKey);
      jest.spyOn(service as any, 'secretMatches').mockReturnValue(true);

      await service.validateApiKey(`tt_${apiKey.keyId}_secret`, '1.1.1.1');

      expect(apiKeyRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ lastUsedIp: '1.1.1.1' }),
      );
    });

    it('does not touch lastUsedAt again within the update throttle window', async () => {
      const apiKey = {
        id: 1,
        userId: 1,
        keyId: 'a'.repeat(24),
        secretHash: '',
        lastUsedAt: new Date(),
        revokedAt: null,
        user: { admin: false, canViewReports: true },
      } as unknown as ApiKey;
      apiKeyRepo.findOne.mockResolvedValue(apiKey);
      jest.spyOn(service as any, 'secretMatches').mockReturnValue(true);

      await service.validateApiKey(`tt_${apiKey.keyId}_secret`);

      expect(apiKeyRepo.update).not.toHaveBeenCalled();
    });

    it('touches lastUsedAt again once the throttle window has elapsed', async () => {
      const apiKey = {
        id: 1,
        userId: 1,
        keyId: 'a'.repeat(24),
        secretHash: '',
        lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        revokedAt: null,
        user: { admin: false, canViewReports: true },
      } as unknown as ApiKey;
      apiKeyRepo.findOne.mockResolvedValue(apiKey);
      jest.spyOn(service as any, 'secretMatches').mockReturnValue(true);

      await service.validateApiKey(`tt_${apiKey.keyId}_secret`);

      expect(apiKeyRepo.update).toHaveBeenCalled();
    });

    it('authenticates against the real secret hash end-to-end, without mocking secretMatches', async () => {
      apiKeyRepo.findOne.mockResolvedValue(null);
      const created = await service.create({ id: 1, admin: false, canViewReports: true } as User);

      const issued = (dataSource.manager.save as jest.Mock).mock.calls
        .map(([entity]) => entity)
        .find(entity => entity && 'secretHash' in entity);
      apiKeyRepo.findOne.mockResolvedValue({
        ...issued,
        revokedAt: null,
        user: { admin: false, canViewReports: true },
      } as ApiKey);

      const result = await service.validateApiKey(created.key);
      expect(result).toEqual({ admin: false, canViewReports: true });

      const wrongResult = await service.validateApiKey(
        `tt_${created.keyId}_${'0'.repeat(43)}`,
      );
      expect(wrongResult).toBeNull();
    });
  });

  describe('revokeStaleKeys', () => {
    const buildQueryBuilder = (raw: { id: number; userId: number }[]) => {
      const qb: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw }),
      };
      dataSource.manager.createQueryBuilder.mockReturnValue(qb);
      return qb;
    };

    it('does nothing when no keys are stale', async () => {
      buildQueryBuilder([]);

      await service.revokeStaleKeys();

      expect(dataSource.manager.save).not.toHaveBeenCalled();
      expect(notificationsPublisher.publish).not.toHaveBeenCalled();
    });

    it('logs an event and emails the owner for each claimed stale key', async () => {
      buildQueryBuilder([{ id: 1, userId: 2 }]);
      apiKeyRepo.find.mockResolvedValue([
        { id: 1, userId: 2, user: { email: 'stale@example.com' } } as ApiKey,
      ]);

      await service.revokeStaleKeys();

      expect(dataSource.manager.save).toHaveBeenCalledWith([
        expect.objectContaining({
          apiKeyId: 1,
          userId: 2,
          eventType: ApiKeyEventType.REVOKED,
          reason: ApiKeyRevokedReason.INACTIVITY,
        }),
      ]);
      expect(notificationsPublisher.publish).toHaveBeenCalledWith(
        'notifications.queue.email.api-key-revoked',
        [
          {
            email: 'stale@example.com',
            additionalData: { reason: ApiKeyRevokedReason.INACTIVITY, idleExpiryDays: 180 },
          },
        ],
      );
    });

    it('revokes and emails every claimed key when multiple keys are stale at once', async () => {
      buildQueryBuilder([
        { id: 1, userId: 2 },
        { id: 3, userId: 4 },
      ]);
      apiKeyRepo.find.mockResolvedValue([
        { id: 1, userId: 2, user: { email: 'first@example.com' } } as ApiKey,
        { id: 3, userId: 4, user: { email: 'second@example.com' } } as ApiKey,
      ]);

      await service.revokeStaleKeys();

      expect(apiKeyRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: In([1, 3]) } }),
      );
      expect(dataSource.manager.save).toHaveBeenCalledWith([
        expect.objectContaining({ apiKeyId: 1, userId: 2 }),
        expect.objectContaining({ apiKeyId: 3, userId: 4 }),
      ]);
      expect(notificationsPublisher.publish).toHaveBeenCalledWith(
        'notifications.queue.email.api-key-revoked',
        [
          {
            email: 'first@example.com',
            additionalData: { reason: ApiKeyRevokedReason.INACTIVITY, idleExpiryDays: 180 },
          },
          {
            email: 'second@example.com',
            additionalData: { reason: ApiKeyRevokedReason.INACTIVITY, idleExpiryDays: 180 },
          },
        ],
      );
    });
  });
});
