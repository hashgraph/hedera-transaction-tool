import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
  const configService = mock<ConfigService>();

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

      const result = await service.create(user as User);

      expect(result.key).toMatch(/^tt_[0-9a-f]{24}_.+$/);
      expect(dataSource.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, revokedAt: null, revokedReason: null }),
      );
      expect(dataSource.manager.create).toHaveBeenCalledWith(
        ApiKeyEvent,
        expect.objectContaining({ eventType: ApiKeyEventType.CREATED }),
      );
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
  });

  describe('validateApiKey', () => {
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

    it('rejects a key already revoked (e.g. by the stale sweep)', async () => {
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

      const result = await service.validateApiKey(`tt_${apiKey.keyId}_secret`);

      expect(result).toBeNull();
      expect(apiKeyRepo.update).not.toHaveBeenCalled();
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
  });
});
