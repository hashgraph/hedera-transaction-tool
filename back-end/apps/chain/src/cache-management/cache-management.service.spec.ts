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
  MirrorNodeCircuitBreaker,
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
  const circuitBreaker = mockDeep<MirrorNodeCircuitBreaker>();

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
        {
          provide: MirrorNodeCircuitBreaker,
          useValue: circuitBreaker,
        },
      ],
    }).compile();

    circuitBreaker.isAvailable.mockReturnValue(true);
    circuitBreaker.recordFailure.mockReturnValue(true);

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

    afterEach(() => {
      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should refresh stale accounts and nodes with jitter', async () => {
      const promise = service.refreshStaleCache();

      await promise;

      expect(service.refreshStaleAccounts).toHaveBeenCalled();
      expect(service.refreshStaleNodes).toHaveBeenCalled();
    });

    it('should log error and re-throw on failure', async () => {
      const error = new Error('Refresh failed');
      jest.spyOn(service, 'refreshStaleAccounts').mockRejectedValue(error);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await expect(service.refreshStaleCache()).rejects.toThrow('Refresh failed');
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should handle error without stack', async () => {
      const error = { message: 'No stack' };
      jest.spyOn(service, 'refreshStaleAccounts').mockRejectedValue(error);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await expect(service.refreshStaleCache()).rejects.toEqual(error);
      expect(loggerSpy).toHaveBeenCalledWith('Cache refresh job failed', 'No stack');
    });

    it('should handle non-error objects', async () => {
      const error = 'string error';
      jest.spyOn(service, 'refreshStaleAccounts').mockRejectedValue(error);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await expect(service.refreshStaleCache()).rejects.toEqual(error);
      expect(loggerSpy).toHaveBeenCalledWith('Cache refresh job failed', 'string error');
    });

    it('should skip execution when a refresh is already in progress', async () => {
      let resolveFirst: () => void;
      const blockingPromise = new Promise<void>(r => { resolveFirst = r; });

      jest.spyOn(service, 'refreshStaleAccounts').mockReturnValue(blockingPromise);

      // Start first invocation (will pause at jitter setTimeout, then block on refreshStaleAccounts)
      const first = service.refreshStaleCache();

      // Flush the jitter setTimeout(0) so the first call reaches refreshStaleAccounts
      await new Promise(r => setTimeout(r, 10));

      // Second invocation should return immediately (no-op)
      await service.refreshStaleCache();

      // refreshStaleAccounts should only have been called once
      expect(service.refreshStaleAccounts).toHaveBeenCalledTimes(1);

      // Unblock and finish
      resolveFirst!();
      await first;
    });

    it('should reset the mutex flag after an error', async () => {
      jest.spyOn(service, 'refreshStaleAccounts').mockRejectedValueOnce(new Error('fail'));

      await expect(service.refreshStaleCache()).rejects.toThrow('fail');

      // Flag should be reset, so next call proceeds
      jest.spyOn(service, 'refreshStaleAccounts').mockResolvedValue(undefined);
      await service.refreshStaleCache();

      expect(service.refreshStaleAccounts).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshStaleAccounts', () => {
    it('should refresh stale accounts and emit transaction updates', async () => {
      const mockAccount1: CachedAccount = { id: 1, account: '0.0.100', mirrorNetwork: 'testnet' } as CachedAccount;
      const mockAccount2: CachedAccount = { id: 2, account: '0.0.200', mirrorNetwork: 'testnet' } as CachedAccount;

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
      const mockAccount1: CachedAccount = { id: 1, account: '0.0.100', mirrorNetwork: 'testnet' } as CachedAccount;
      const mockAccount2: CachedAccount = { id: 2, account: '0.0.200', mirrorNetwork: 'testnet' } as CachedAccount;

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
      const mockAccount: CachedAccount = { id: 1, account: '0.0.100', mirrorNetwork: 'testnet' } as CachedAccount;

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
      const mockNode1: CachedNode = { id: 1, nodeId: 3, mirrorNetwork: 'testnet' } as CachedNode;
      const mockNode2: CachedNode = { id: 2, nodeId: 4, mirrorNetwork: 'testnet' } as CachedNode;

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

  describe('circuit breaker integration', () => {
    const setupAccountTransaction = (accounts: CachedAccount[]) => {
      const transactionAccounts = accounts.map((a, i) => ({
        cachedAccountId: a.id,
        transaction: { id: 100 + i },
      }));

      const accountQueryBuilder = createMockQueryBuilder();
      accountQueryBuilder.getMany.mockResolvedValue(accounts);

      const transactionQueryBuilder = createMockQueryBuilder();
      transactionQueryBuilder.getMany.mockResolvedValue(transactionAccounts);

      const mockManager = {
        createQueryBuilder: jest.fn()
          .mockReturnValueOnce(accountQueryBuilder)
          .mockReturnValueOnce(transactionQueryBuilder),
      };

      dataSource.transaction = jest.fn(async (callback) => callback(mockManager)) as any;
    };

    const setupNodeTransaction = (nodes: CachedNode[]) => {
      const transactionNodes = nodes.map((n, i) => ({
        cachedNodeId: n.id,
        transaction: { id: 200 + i },
      }));

      const nodeQueryBuilder = createMockQueryBuilder();
      nodeQueryBuilder.getMany.mockResolvedValue(nodes);

      const transactionQueryBuilder = createMockQueryBuilder();
      transactionQueryBuilder.getMany.mockResolvedValue(transactionNodes);

      const mockManager = {
        createQueryBuilder: jest.fn()
          .mockReturnValueOnce(nodeQueryBuilder)
          .mockReturnValueOnce(transactionQueryBuilder),
      };

      dataSource.transaction = jest.fn(async (callback) => callback(mockManager)) as any;
    };

    it('should skip accounts on circuit-broken networks', async () => {
      const accounts = [
        { id: 1, account: '0.0.100', mirrorNetwork: 'testnet' } as CachedAccount,
        { id: 2, account: '0.0.200', mirrorNetwork: 'testnet' } as CachedAccount,
      ];
      setupAccountTransaction(accounts);

      circuitBreaker.isAvailable.mockReturnValue(false);
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      await service.refreshStaleAccounts();

      expect(accountCacheService.refreshAccount).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping 2 stale account(s) for network "testnet" (circuit open)'),
      );
    });

    it('should skip nodes on circuit-broken networks', async () => {
      const nodes = [
        { id: 1, nodeId: 3, mirrorNetwork: 'testnet' } as CachedNode,
      ];
      setupNodeTransaction(nodes);

      circuitBreaker.isAvailable.mockReturnValue(false);
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      await service.refreshStaleNodes();

      expect(nodeCacheService.refreshNode).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping 1 stale node(s) for network "testnet" (circuit open)'),
      );
    });

    it('should continue processing healthy networks when another is circuit-broken', async () => {
      const accounts = [
        { id: 1, account: '0.0.100', mirrorNetwork: 'deadnet' } as CachedAccount,
        { id: 2, account: '0.0.200', mirrorNetwork: 'healthynet' } as CachedAccount,
      ];
      setupAccountTransaction(accounts);

      circuitBreaker.isAvailable.mockImplementation(
        (network: string) => network !== 'deadnet',
      );
      accountCacheService.refreshAccount.mockResolvedValue(true);

      await service.refreshStaleAccounts();

      expect(accountCacheService.refreshAccount).toHaveBeenCalledTimes(1);
      expect(accountCacheService.refreshAccount).toHaveBeenCalledWith(accounts[1]);
    });

    it('should call recordSuccess on any non-throwing refresh', async () => {
      const accounts = [
        { id: 1, account: '0.0.100', mirrorNetwork: 'testnet' } as CachedAccount,
      ];
      setupAccountTransaction(accounts);
      accountCacheService.refreshAccount.mockResolvedValue(false);

      await service.refreshStaleAccounts();

      expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('testnet');
    });

    it('should call recordFailure on failed refresh', async () => {
      const accounts = [
        { id: 1, account: '0.0.100', mirrorNetwork: 'testnet' } as CachedAccount,
      ];
      setupAccountTransaction(accounts);
      accountCacheService.refreshAccount.mockRejectedValue(new Error('Mirror node down'));

      await service.refreshStaleAccounts();

      expect(circuitBreaker.recordFailure).toHaveBeenCalledWith('testnet');
    });

    it('should break out of network group when circuit opens mid-iteration', async () => {
      const accounts = [
        { id: 1, account: '0.0.100', mirrorNetwork: 'testnet' } as CachedAccount,
        { id: 2, account: '0.0.200', mirrorNetwork: 'testnet' } as CachedAccount,
        { id: 3, account: '0.0.300', mirrorNetwork: 'testnet' } as CachedAccount,
      ];
      setupAccountTransaction(accounts);

      // Group-level isAvailable check passes
      circuitBreaker.isAvailable.mockReturnValue(true);
      // First recordFailure returns false -> circuit just opened
      circuitBreaker.recordFailure.mockReturnValue(false);

      accountCacheService.refreshAccount.mockRejectedValue(new Error('fail'));

      await service.refreshStaleAccounts();

      // Only the first account should have been attempted
      expect(accountCacheService.refreshAccount).toHaveBeenCalledTimes(1);
    });

    it('should produce one aggregate error log per network', async () => {
      const accounts = [
        { id: 1, account: '0.0.100', mirrorNetwork: 'testnet' } as CachedAccount,
        { id: 2, account: '0.0.200', mirrorNetwork: 'testnet' } as CachedAccount,
      ];
      setupAccountTransaction(accounts);

      accountCacheService.refreshAccount.mockRejectedValue(new Error('connection refused'));
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      await service.refreshStaleAccounts();

      // Should produce exactly one aggregate warn log for the network
      const networkWarnCalls = loggerSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('Account refresh failures'),
      );
      expect(networkWarnCalls).toHaveLength(1);
      expect(networkWarnCalls[0][0]).toContain('connection refused');
    });

    it('should deduplicate error messages in aggregate log', async () => {
      const accounts = [
        { id: 1, account: '0.0.100', mirrorNetwork: 'testnet' } as CachedAccount,
        { id: 2, account: '0.0.200', mirrorNetwork: 'testnet' } as CachedAccount,
      ];
      setupAccountTransaction(accounts);

      // Both fail with the same error
      accountCacheService.refreshAccount.mockRejectedValue(new Error('same error'));
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      await service.refreshStaleAccounts();

      const networkWarnCalls = loggerSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('Account refresh failures'),
      );
      expect(networkWarnCalls).toHaveLength(1);
      // The message "same error" should appear only once, not twice
      const logMsg = networkWarnCalls[0][0] as string;
      expect(logMsg.split('same error').length - 1).toBe(1);
    });

    it('per-entity errors should not stop the batch', async () => {
      const accounts = [
        { id: 1, account: '0.0.100', mirrorNetwork: 'testnet' } as CachedAccount,
        { id: 2, account: '0.0.200', mirrorNetwork: 'testnet' } as CachedAccount,
      ];
      setupAccountTransaction(accounts);

      // First fails, second succeeds
      accountCacheService.refreshAccount
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(true);

      await service.refreshStaleAccounts();

      expect(accountCacheService.refreshAccount).toHaveBeenCalledTimes(2);
      expect(circuitBreaker.recordFailure).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.recordSuccess).toHaveBeenCalledTimes(1);
    });

    // --- Node-path circuit breaker tests ---

    it('should continue processing healthy networks when another node network is circuit-broken', async () => {
      const nodes = [
        { id: 1, nodeId: 3, mirrorNetwork: 'deadnet' } as CachedNode,
        { id: 2, nodeId: 4, mirrorNetwork: 'healthynet' } as CachedNode,
      ];
      setupNodeTransaction(nodes);

      circuitBreaker.isAvailable.mockImplementation(
        (network: string) => network !== 'deadnet',
      );
      nodeCacheService.refreshNode.mockResolvedValue(true);

      await service.refreshStaleNodes();

      expect(nodeCacheService.refreshNode).toHaveBeenCalledTimes(1);
      expect(nodeCacheService.refreshNode).toHaveBeenCalledWith(nodes[1]);
    });

    it('should call recordSuccess on any non-throwing node refresh', async () => {
      const nodes = [
        { id: 1, nodeId: 3, mirrorNetwork: 'testnet' } as CachedNode,
      ];
      setupNodeTransaction(nodes);
      nodeCacheService.refreshNode.mockResolvedValue(false);

      await service.refreshStaleNodes();

      expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('testnet');
    });

    it('should call recordFailure on failed node refresh', async () => {
      const nodes = [
        { id: 1, nodeId: 3, mirrorNetwork: 'testnet' } as CachedNode,
      ];
      setupNodeTransaction(nodes);
      nodeCacheService.refreshNode.mockRejectedValue(new Error('Mirror node down'));

      await service.refreshStaleNodes();

      expect(circuitBreaker.recordFailure).toHaveBeenCalledWith('testnet');
    });

    it('should break out of node network group when circuit opens mid-iteration', async () => {
      const nodes = [
        { id: 1, nodeId: 3, mirrorNetwork: 'testnet' } as CachedNode,
        { id: 2, nodeId: 4, mirrorNetwork: 'testnet' } as CachedNode,
        { id: 3, nodeId: 5, mirrorNetwork: 'testnet' } as CachedNode,
      ];
      setupNodeTransaction(nodes);

      // Group-level isAvailable check passes
      circuitBreaker.isAvailable.mockReturnValue(true);
      // First recordFailure returns false -> circuit just opened
      circuitBreaker.recordFailure.mockReturnValue(false);

      nodeCacheService.refreshNode.mockRejectedValue(new Error('fail'));

      await service.refreshStaleNodes();

      expect(nodeCacheService.refreshNode).toHaveBeenCalledTimes(1);
    });

    it('per-entity node errors should not stop the batch', async () => {
      const nodes = [
        { id: 1, nodeId: 3, mirrorNetwork: 'testnet' } as CachedNode,
        { id: 2, nodeId: 4, mirrorNetwork: 'testnet' } as CachedNode,
      ];
      setupNodeTransaction(nodes);

      nodeCacheService.refreshNode
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(true);

      await service.refreshStaleNodes();

      expect(nodeCacheService.refreshNode).toHaveBeenCalledTimes(2);
      expect(circuitBreaker.recordFailure).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.recordSuccess).toHaveBeenCalledTimes(1);
    });

    it('should process all entities across multiple healthy networks', async () => {
      const accounts = [
        { id: 1, account: '0.0.100', mirrorNetwork: 'testnet' } as CachedAccount,
        { id: 2, account: '0.0.200', mirrorNetwork: 'testnet' } as CachedAccount,
        { id: 3, account: '0.0.300', mirrorNetwork: 'mainnet' } as CachedAccount,
        { id: 4, account: '0.0.400', mirrorNetwork: 'mainnet' } as CachedAccount,
      ];
      setupAccountTransaction(accounts);

      circuitBreaker.isAvailable.mockReturnValue(true);
      accountCacheService.refreshAccount.mockResolvedValue(true);

      await service.refreshStaleAccounts();

      expect(accountCacheService.refreshAccount).toHaveBeenCalledTimes(4);
      expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('testnet');
      expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('mainnet');
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