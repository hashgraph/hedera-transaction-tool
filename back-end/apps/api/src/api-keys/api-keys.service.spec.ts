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
});
