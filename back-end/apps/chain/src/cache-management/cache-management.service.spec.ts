import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import {
  CachedAccount,
  CachedNode,
  TransactionStatus,
} from '@entities';
import {
  AccountCacheService,
  NatsPublisherService,
  NodeCacheService,
  emitTransactionUpdate,
} from '@app/common';
import { CacheManagementService } from './cache-management.service';
import { mockDeep } from 'jest-mock-extended';

jest.mock('@app/common', () => ({
  ...jest.requireActual('@app/common'),
  emitTransactionUpdate: jest.fn(),
}));

function returningRows(count: number): [any[], number] {
  return [[], count];
}

describe('CacheManagementService', () => {
  let service: CacheManagementService;

  const dataSource = mockDeep<DataSource>();
  const accountCacheService = mockDeep<AccountCacheService>();
  const nodeCacheService = mockDeep<NodeCacheService>();
  const accountRepository = mockDeep<Repository<CachedAccount>>();
  const nodeRepository = mockDeep<Repository<CachedNode>>();
  const configService = mockDeep<ConfigService>();
  const notificationsPublisher = mockDeep<NatsPublisherService>();

  const createMockQueryBuilder = () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      setOnLocked: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    } as unknown as jest.Mocked<SelectQueryBuilder<any>>;
    return mockQueryBuilder;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheManagementService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: AccountCacheService,
          useValue: accountCacheService,
        },
        {
          provide: NodeCacheService,
          useValue: nodeCacheService,
        },
        {
          provide: getRepositoryToken(CachedAccount),
          useValue: accountRepository,
        },
        {
          provide: getRepositoryToken(CachedNode),
          useValue: nodeRepository,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: NatsPublisherService,
          useValue: notificationsPublisher,
        },
      ],
    }).compile();

    service = module.get<CacheManagementService>(CacheManagementService);
  });

  describe('constructor', () => {
    it('should initialize with config values', () => {
      expect(configService.get).toHaveBeenCalledWith('CACHE_STALE_THRESHOLD_MS', 10000);
      expect(configService.get).toHaveBeenCalledWith('CACHE_REFRESH_BATCH_SIZE', 100);
      expect(configService.get).toHaveBeenCalledWith('CACHE_CLAIM_TIMEOUT_MS', 10000);
    });
  });

  describe('refreshStaleCache', () => {
    beforeEach(() => {
      jest.spyOn(service, 'refreshStaleAccounts').mockResolvedValue(undefined);
      jest.spyOn(service, 'refreshStaleNodes').mockResolvedValue(undefined);
      jest.spyOn(Math, 'random').mockReturnValue(0);
    });

    it('should refresh stale accounts and nodes with jitter', async () => {
      const promise = service.refreshStaleCache();

      await promise;

      expect(service.refreshStaleAccounts).toHaveBeenCalled();
      expect(service.refreshStaleNodes).toHaveBeenCalled();
    });

    it('should throw and log error on failure', async () => {
      const error = new Error('Refresh failed');
      jest.spyOn(service, 'refreshStaleAccounts').mockRejectedValue(error);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      const promise = service.refreshStaleCache();

      await expect(promise).rejects.toThrow(error);
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should handle error without stack', async () => {
      const error = { message: 'No stack' };
      jest.spyOn(service, 'refreshStaleAccounts').mockRejectedValue(error);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      const promise = service.refreshStaleCache();

      await expect(promise).rejects.toEqual(error);
      expect(loggerSpy).toHaveBeenCalledWith('Cache refresh job failed', 'No stack');
    });

    it('should handle non-error objects', async () => {
      const error = 'string error';
      jest.spyOn(service, 'refreshStaleAccounts').mockRejectedValue(error);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      const promise = service.refreshStaleCache();

      await expect(promise).rejects.toEqual(error);
      expect(loggerSpy).toHaveBeenCalledWith('Cache refresh job failed', 'string error');
    });
  });

  describe('refreshStaleAccounts', () => {
    it('should refresh stale accounts and emit transaction updates', async () => {
      const mockAccount1: CachedAccount = { id: 1, account: '0.0.100' } as CachedAccount;
      const mockAccount2: CachedAccount = { id: 2, account: '0.0.200' } as CachedAccount;

      const mockTransactionAccount = {
        cachedAccount: mockAccount1,
        cachedAccountId: mockAccount1.id,
        transaction: { id: 10 },
      };

      const accountQueryBuilder = createMockQueryBuilder();
      accountQueryBuilder.getMany.mockResolvedValue([mockAccount1, mockAccount2]);

      const transactionQueryBuilder = createMockQueryBuilder();
      transactionQueryBuilder.getMany.mockResolvedValue([mockTransactionAccount]);

      const mockManager = {
        createQueryBuilder: jest.fn()
          .mockReturnValueOnce(accountQueryBuilder)
          .mockReturnValueOnce(transactionQueryBuilder),
      };

      dataSource.transaction = jest.fn(async (callback) => callback(mockManager)) as any;

      accountCacheService.refreshAccount
        .mockResolvedValueOnce(true)  // Account 1 refreshed
        .mockResolvedValueOnce(false); // Account 2 not refreshed

      await service.refreshStaleAccounts();

      expect(accountCacheService.refreshAccount).toHaveBeenCalledTimes(2);
      expect(emitTransactionUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        [{ entityId: 10 }]
      );
    });

    it('should handle empty stale accounts', async () => {
      const accountQueryBuilder = createMockQueryBuilder();
      accountQueryBuilder.getMany.mockResolvedValue([]);

      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue(accountQueryBuilder),
      };

      dataSource.transaction = jest.fn(async (callback) => callback(mockManager)) as any;

      await service.refreshStaleAccounts();

      expect(accountCacheService.refreshAccount).not.toHaveBeenCalled();
      expect(emitTransactionUpdate).not.toHaveBeenCalled();
    });

    it('should deduplicate transaction IDs across multiple accounts', async () => {
      const mockAccount1: CachedAccount = { id: 1, account: '0.0.100' } as CachedAccount;
      const mockAccount2: CachedAccount = { id: 2, account: '0.0.200' } as CachedAccount;

      const mockTransactionAccounts = [
        { cachedAccount: mockAccount1, cachedAccountId: mockAccount1.id, transaction: { id: 10 } },
        { cachedAccount: mockAccount1, cachedAccountId: mockAccount1.id, transaction: { id: 20 } },
        { cachedAccount: mockAccount2, cachedAccountId: mockAccount2.id, transaction: { id: 10 } }, // Duplicate transaction ID
      ];

      const accountQueryBuilder = createMockQueryBuilder();
      accountQueryBuilder.getMany.mockResolvedValue([mockAccount1, mockAccount2]);

      const transactionQueryBuilder = createMockQueryBuilder();
      transactionQueryBuilder.getMany.mockResolvedValue(mockTransactionAccounts);

      const mockManager = {
        createQueryBuilder: jest.fn()
          .mockReturnValueOnce(accountQueryBuilder)
          .mockReturnValueOnce(transactionQueryBuilder),
      };

      dataSource.transaction = jest.fn(async (callback) => callback(mockManager)) as any;

      accountCacheService.refreshAccount.mockResolvedValue(true);

      await service.refreshStaleAccounts();

      expect(emitTransactionUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        expect.arrayContaining([
          { entityId: 10 },
          { entityId: 20 },
        ])
      );
      // Should only have 2 unique transaction IDs
      expect((emitTransactionUpdate as jest.Mock).mock.calls[0][1]).toHaveLength(2);
    });

    it('should not emit updates when no accounts were refreshed', async () => {
      const mockAccount: CachedAccount = { id: 1, account: '0.0.100' } as CachedAccount;

      const accountQueryBuilder = createMockQueryBuilder();
      accountQueryBuilder.getMany.mockResolvedValue([mockAccount]);

      const transactionQueryBuilder = createMockQueryBuilder();
      transactionQueryBuilder.getMany.mockResolvedValue([]);

      const mockManager = {
        createQueryBuilder: jest.fn()
          .mockReturnValueOnce(accountQueryBuilder)
          .mockReturnValueOnce(transactionQueryBuilder),
      };

      dataSource.transaction = jest.fn(async (callback) => callback(mockManager)) as any;

      accountCacheService.refreshAccount.mockResolvedValue(false);

      await service.refreshStaleAccounts();

      expect(emitTransactionUpdate).not.toHaveBeenCalled();
    });
  });

  describe('refreshStaleNodes', () => {
    it('should refresh stale nodes and emit transaction updates', async () => {
      const mockNode1: CachedNode = { id: 1, nodeId: 3 } as CachedNode;
      const mockNode2: CachedNode = { id: 2, nodeId: 4 } as CachedNode;

      const mockTransactionNode = {
        cachedNode: mockNode1,
        cachedNodeId: mockNode1.id,
        transaction: { id: 30 },
      };

      const nodeQueryBuilder = createMockQueryBuilder();
      nodeQueryBuilder.getMany.mockResolvedValue([mockNode1, mockNode2]);

      const transactionQueryBuilder = createMockQueryBuilder();
      transactionQueryBuilder.getMany.mockResolvedValue([mockTransactionNode]);

      const mockManager = {
        createQueryBuilder: jest.fn()
          .mockReturnValueOnce(nodeQueryBuilder)
          .mockReturnValueOnce(transactionQueryBuilder),
      };

      dataSource.transaction = jest.fn(async (callback) => callback(mockManager)) as any;

      nodeCacheService.refreshNode
        .mockResolvedValueOnce(true)  // Node 1 refreshed
        .mockResolvedValueOnce(false); // Node 2 not refreshed

      await service.refreshStaleNodes();

      expect(nodeCacheService.refreshNode).toHaveBeenCalledTimes(2);
      expect(emitTransactionUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        [{ entityId: 30 }]
      );
    });

    it('should handle empty stale nodes', async () => {
      const nodeQueryBuilder = createMockQueryBuilder();
      nodeQueryBuilder.getMany.mockResolvedValue([]);

      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue(nodeQueryBuilder),
      };

      dataSource.transaction = jest.fn(async (callback) => callback(mockManager)) as any;

      await service.refreshStaleNodes();

      expect(nodeCacheService.refreshNode).not.toHaveBeenCalled();
      expect(emitTransactionUpdate).not.toHaveBeenCalled();
    });
  });

  describe('extractAffectedCount', () => {
    it('should extract count from null/undefined', () => {
      expect((service as any).extractAffectedCount(null)).toBe(0);
      expect((service as any).extractAffectedCount(undefined)).toBe(0);
    });

    it('should extract count from number', () => {
      expect((service as any).extractAffectedCount(42)).toBe(42);
    });

    it('should extract count from affectedRows', () => {
      expect((service as any).extractAffectedCount({ affectedRows: 10 })).toBe(10);
    });

    it('should extract count from rowCount', () => {
      expect((service as any).extractAffectedCount({ rowCount: 15 })).toBe(15);
    });

    it('should extract count when result is an array and second element is a number', () => {
      expect((service as any).extractAffectedCount([null, 3])).toBe(3);
    });

    it('should extract zero when result is an array and second element is 0', () => {
      expect((service as any).extractAffectedCount([null, 0])).toBe(0);
    });

    it('should extract count from array with affectedRows', () => {
      expect((service as any).extractAffectedCount([null, { affectedRows: 20 }])).toBe(20);
    });

    it('should extract count from array with rowCount', () => {
      expect((service as any).extractAffectedCount([null, { rowCount: 25 }])).toBe(25);
    });

    it('should return 0 when result is an array and second element has no rowCount/affectedRows', () => {
      expect((service as any).extractAffectedCount([null, { something: 'else' }])).toBe(0);
    });

    it('should return 0 for unrecognized format', () => {
      expect((service as any).extractAffectedCount({ something: 'else' })).toBe(0);
    });
  });

  describe('cleanupUnusedCache', () => {
    it('should cleanup unused accounts and nodes', async () => {
      accountRepository.query.mockResolvedValue(returningRows(5));
      nodeRepository.query.mockResolvedValue(returningRows(3));

      const result = await service.cleanupUnusedCache();

      expect(result).toEqual({
        accountsRemoved: 5,
        nodesRemoved: 3,
        duration: expect.any(Number),
      });
    });

    it('should log error on failure', async () => {
      const error = new Error('Cleanup failed');
      accountRepository.query.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await expect(service.cleanupUnusedCache()).rejects.toThrow('Cleanup failed');
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should handle error without stack', async () => {
      const error = { message: 'No stack error' };
      accountRepository.query.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await expect(service.cleanupUnusedCache()).rejects.toEqual(error);
      expect(loggerSpy).toHaveBeenCalledWith('Cache cleanup job failed', 'No stack error');
    });

    it('should handle non-error objects in cleanup', async () => {
      const error = 'string error';
      accountRepository.query.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await expect(service.cleanupUnusedCache()).rejects.toEqual(error);
      expect(loggerSpy).toHaveBeenCalledWith('Cache cleanup job failed', 'string error');
    });
  });

  describe('cleanupUnusedAccounts', () => {
    it('returns the number of deleted rows based on RETURNING', async () => {
      accountRepository.query.mockResolvedValue(returningRows(7));

      const result = await (service as any).cleanupUnusedAccounts();

      expect(result).toBe(7);
      expect(accountRepository.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM cached_account'),
        [
          TransactionStatus.WAITING_FOR_SIGNATURES,
          TransactionStatus.WAITING_FOR_EXECUTION,
        ],
      );
    });

    it('returns 0 when no rows were deleted', async () => {
      accountRepository.query.mockResolvedValue(returningRows(0));

      const result = await (service as any).cleanupUnusedAccounts();

      expect(result).toBe(0);
    });
  });

  describe('cleanupUnusedNodes', () => {
    it('returns the number of deleted rows based on RETURNING', async () => {
      nodeRepository.query.mockResolvedValue(returningRows(4));

      const result = await (service as any).cleanupUnusedNodes();

      expect(result).toBe(4);
      expect(nodeRepository.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM cached_node'),
        [
          TransactionStatus.WAITING_FOR_SIGNATURES,
          TransactionStatus.WAITING_FOR_EXECUTION,
        ],
      );
    });

    it('returns 0 when no rows were deleted', async () => {
      nodeRepository.query.mockResolvedValue(returningRows(0));

      const result = await (service as any).cleanupUnusedNodes();

      expect(result).toBe(0);
    });
  });
});