import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AccountId, PrivateKey } from '@hashgraph/sdk';

import { NodeCacheService } from './node-cache.service';
import { MirrorNodeClient } from './mirror-node.client';
import { CacheHelper } from './cache.helper';
import { RefreshStatus } from '.';
import {
  CachedNode,
  CachedNodeAdminKey,
  Transaction,
  TransactionCachedNode,
} from '@entities';
import {
  deserializeKey,
  flattenKeyList,
  NodeInfoParsed,
  serializeKey,
  SqlBuilderService,
} from '@app/common';
import { mockDeep } from 'jest-mock-extended';

jest.mock('@app/common', () => ({
  ...jest.requireActual('@app/common'),
  serializeKey: jest.fn((key) => Buffer.from(`serialized-${key}`)),
  deserializeKey: jest.fn((encoded) => `deserialized-${encoded}`),
  flattenKeyList: jest.fn((key) => [key]),
}));

describe('NodeCacheService', () => {
  let service: NodeCacheService;
  let mirrorNodeClient: jest.Mocked<MirrorNodeClient>;
  let dataSource: jest.Mocked<DataSource>;
  let cacheHelper: jest.Mocked<CacheHelper>;
  let configService: jest.Mocked<ConfigService>;

  const sqlBuilderService = mockDeep<SqlBuilderService>();

  const mockTransaction: Transaction = {
    id: 1,
    mirrorNetwork: 'testnet',
  } as Transaction;

  const mockKey = PrivateKey.generateED25519().publicKey;

  beforeEach(async () => {
    const mockManager = {
      findOne: jest.fn(),
    };

    mirrorNodeClient = {
      fetchNodeInfo: jest.fn(),
    } as any;

    dataSource = {
      manager: mockManager,
    } as any;

    cacheHelper = {
      tryClaimRefresh: jest.fn(),
      saveAndReleaseClaim: jest.fn(),
      linkTransactionToEntity: jest.fn(),
      insertKeys: jest.fn(),
    } as any;

    configService = {
      get: jest.fn((key, defaultValue) => defaultValue),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodeCacheService,
        { provide: MirrorNodeClient, useValue: mirrorNodeClient },
        {
          provide: 'cacheDataSource',
          useValue: dataSource,
        },
        { provide: ConfigService, useValue: configService },
        { provide: SqlBuilderService, useValue: sqlBuilderService },
      ],
    }).compile();

    service = module.get<NodeCacheService>(NodeCacheService);
    // Inject mock cacheHelper
    (service as any).cacheHelper = cacheHelper;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with config values', () => {
      expect(configService.get).toHaveBeenCalledWith('CACHE_STALE_THRESHOLD_MS', 10000);
      expect(configService.get).toHaveBeenCalledWith('CACHE_CLAIM_TIMEOUT_MS', 10000);
    });
  });

  describe('refreshNode', () => {
    it('should return true when node is successfully refreshed', async () => {
      const cachedNode = {
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedNode;
      const nodeInfo: Partial<NodeInfoParsed> = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      }

      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: cachedNode, claimed: true });
      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: nodeInfo as NodeInfoParsed,
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await service.refreshNode(cachedNode);

      expect(result).toBe(true);
      expect(cacheHelper.tryClaimRefresh).toHaveBeenCalledWith(
        sqlBuilderService,
        CachedNode,
        { nodeId: 1, mirrorNetwork: 'testnet' },
        10000
      );
    });

    it('should return false when node is already being refreshed', async () => {
      const cachedNode = {
        nodeId: 1,
        mirrorNetwork: 'testnet',
      } as CachedNode;

      const claimedNode = { ...cachedNode, refreshToken: null } as CachedNode;
      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: claimedNode, claimed: false });

      const result = await service.refreshNode(cachedNode);

      expect(result).toBe(false);
      expect(mirrorNodeClient.fetchNodeInfo).not.toHaveBeenCalled();
    });

    it('should return false when refresh status is NOT_MODIFIED', async () => {
      const cachedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: Buffer.from('encoded-key'),
      } as CachedNode;

      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: cachedNode, claimed: true });
      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: null, // 304 Not Modified
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await service.refreshNode(cachedNode);

      expect(result).toBe(false);
    });

    it('should return false when refresh status is NOT_FOUND', async () => {
      const cachedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedNode;

      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: cachedNode, claimed: false });
      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: null,
        etag: null,
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await service.refreshNode(cachedNode);

      expect(result).toBe(false);
    });

    it('should return false when HTTP 200 but data is identical to cached', async () => {
      const serializedMockKey = Buffer.from(`serialized-${mockKey}`);
      const cachedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: serializedMockKey,
        nodeAccountId: '0.0.3',
      } as unknown as CachedNode;

      const nodeInfo: Partial<NodeInfoParsed> = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      };

      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: cachedNode, claimed: true });
      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: nodeInfo as NodeInfoParsed,
        etag: 'new-etag',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await service.refreshNode(cachedNode);

      expect(result).toBe(false);
    });
  });

  describe('getNodeInfoForTransaction', () => {
    it('should return null when transaction is null', async () => {
      const result = await service.getNodeInfoForTransaction(null as any, 1);
      expect(result).toBeNull();
    });

    it('should return null when transaction has no mirrorNetwork', async () => {
      const tx = { id: 1 } as Transaction;
      const result = await service.getNodeInfoForTransaction(tx, 1);
      expect(result).toBeNull();
    });


    it('should throw error for invalid nodeId', async () => {
      await expect(service.getNodeInfoForTransaction(mockTransaction, -1)).rejects.toThrow(
        new HttpException('Invalid node ID: must be a non-negative integer', HttpStatus.BAD_REQUEST)
      );
    });

    it('should return cached data when fresh and complete', async () => {
      const cachedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        nodeAccountId: '0.0.3',
        encodedKey: Buffer.from('encoded-key'),
        updatedAt: new Date(),
      } as CachedNode;

      dataSource.manager.findOne = jest.fn().mockResolvedValue(cachedNode);
      cacheHelper.linkTransactionToEntity.mockResolvedValue(undefined);

      const result = await service.getNodeInfoForTransaction(mockTransaction, 1);
      expect(result).toEqual({
        admin_key: 'deserialized-encoded-key',
        node_account_id: AccountId.fromString('0.0.3'),
      });
      expect(cacheHelper.linkTransactionToEntity).toHaveBeenCalledWith(
        TransactionCachedNode,
        1,
        1,
        'cachedNode'
      );
    });

    it('should fetch new data when cache is stale', async () => {
      const staleDate = new Date(Date.now() - 20000);
      const cachedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        nodeAccountId: '0.0.3',
        encodedKey: Buffer.from('old-key'),
        updatedAt: staleDate,
        refreshToken: 'token-123',
      } as CachedNode;
      const nodeInfo: Partial<NodeInfoParsed> = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      };

      dataSource.manager.findOne = jest.fn().mockResolvedValue(cachedNode);
      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: cachedNode, claimed: true });
      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: nodeInfo as NodeInfoParsed,
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await service.getNodeInfoForTransaction(mockTransaction, 1);
      expect(result).toEqual({
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      });
    });

    it('should fetch new data when cache is missing', async () => {
      dataSource.manager.findOne = jest.fn().mockResolvedValue(null);

      const claimedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedNode;
      const nodeInfo: Partial<NodeInfoParsed> = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      }

      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: claimedNode, claimed: true });
      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: nodeInfo as NodeInfoParsed,
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await service.getNodeInfoForTransaction(mockTransaction, 1);

      expect(result).toEqual({
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      });
    });

    it('should return cached data when another process is refreshing', async () => {
      const cachedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        nodeAccountId: '0.0.3',
        encodedKey: Buffer.from('encoded-key'),
        updatedAt: new Date(Date.now() - 20000),
      } as CachedNode;

      const claimedNode = {
        ...cachedNode,
        refreshToken: null, // Already being refreshed
      };

      dataSource.manager.findOne = jest.fn().mockResolvedValue(cachedNode);
      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: claimedNode, claimed: false });
      cacheHelper.linkTransactionToEntity.mockResolvedValue(undefined);

      const result = await service.getNodeInfoForTransaction(mockTransaction, 1);

      expect(result).toEqual({
        admin_key: 'deserialized-encoded-key',
        node_account_id: AccountId.fromString('0.0.3'),
      });
    });

    it('should return null when another process is refreshing and no cached data exists', async () => {
      const claimedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: null, // Already being refreshed
        encodedKey: null, // No data
      } as CachedNode;

      dataSource.manager.findOne = jest.fn().mockResolvedValue(null);
      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: claimedNode, claimed: false });

      const result = await service.getNodeInfoForTransaction(mockTransaction, 1);

      expect(result).toBeNull();
    });
  });

  describe('performRefreshForClaimedNode', () => {
    it('should return REFRESHED status with new data', async () => {
      const claimedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedNode;
      const nodeInfo: Partial<NodeInfoParsed> = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      }

      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: nodeInfo as NodeInfoParsed,
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedNode(claimedNode);

      expect(result.status).toBe(RefreshStatus.REFRESHED);
      expect(result.data).toEqual({
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      });
    });

    it('should return NOT_MODIFIED status with cached data on 304', async () => {
      const claimedNode = {
        id: 1,
        nodeId: 1,
        nodeAccountId: '0.0.3',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: Buffer.from('encoded-key'),
      } as CachedNode;

      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: null, // 304
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedNode(claimedNode);

      expect(result.status).toBe(RefreshStatus.NOT_MODIFIED);
      expect(result.data).toEqual({
        admin_key: 'deserialized-encoded-key',
        node_account_id: AccountId.fromString('0.0.3'),
      });
    });

    it('should return NOT_FOUND status when node not found', async () => {
      const claimedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedNode;

      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: null,
        etag: null,
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedNode(claimedNode);

      expect(result.status).toBe(RefreshStatus.NOT_FOUND);
      expect(result.data).toBeNull();
    });

    it('should clear refresh token and rethrow on error', async () => {
      const claimedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedNode;

      const error = new Error('Network error');
      mirrorNodeClient.fetchNodeInfo.mockRejectedValue(error);
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      await expect(
        (service as any).performRefreshForClaimedNode(claimedNode)
      ).rejects.toThrow('Network error');

      expect(cacheHelper.saveAndReleaseClaim).toHaveBeenCalledWith(
        CachedNode,
        { nodeId: 1, mirrorNetwork: 'testnet' },
        'token-123',
        {}
      );
    });

    it('should log error when clearing refresh token fails after error', async () => {
      const claimedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedNode;

      const fetchError = new Error('Network error');
      const saveError = new Error('Save error');

      mirrorNodeClient.fetchNodeInfo.mockRejectedValue(fetchError);
      cacheHelper.saveAndReleaseClaim.mockRejectedValue(saveError);

      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await expect(
        (service as any).performRefreshForClaimedNode(claimedNode)
      ).rejects.toThrow('Network error');

      expect(loggerSpy).toHaveBeenCalledWith('Failed to clear refresh token after error', saveError);
    });

    it('should link transaction when transactionId provided', async () => {
      const claimedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedNode;

      const nodeInfo: Partial<NodeInfoParsed> = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      }

      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: nodeInfo as NodeInfoParsed,
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      await (service as any).performRefreshForClaimedNode(claimedNode, 999);

      expect(cacheHelper.linkTransactionToEntity).toHaveBeenCalledWith(
        TransactionCachedNode,
        999,
        1,
        'cachedNode'
      );
    });

    it('should return DATA_UNCHANGED when fetched data matches cached data', async () => {
      const serializedMockKey = Buffer.from(`serialized-${mockKey}`);
      const claimedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: serializedMockKey,
        nodeAccountId: '0.0.3',
      } as unknown as CachedNode;

      const nodeInfo: Partial<NodeInfoParsed> = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      };

      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: nodeInfo as NodeInfoParsed,
        etag: 'new-etag',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedNode(claimedNode);

      expect(result.status).toBe(RefreshStatus.DATA_UNCHANGED);
      expect(result.data).toEqual({
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      });
    });

    it('should return REFRESHED when admin key differs', async () => {
      const otherKey = PrivateKey.generateED25519().publicKey;
      const claimedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: Buffer.from(`serialized-${otherKey}`),
        nodeAccountId: '0.0.3',
      } as unknown as CachedNode;

      const nodeInfo: Partial<NodeInfoParsed> = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      };

      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: nodeInfo as NodeInfoParsed,
        etag: 'new-etag',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedNode(claimedNode);

      expect(result.status).toBe(RefreshStatus.REFRESHED);
    });

    it('should return REFRESHED when nodeAccountId differs', async () => {
      const serializedMockKey = Buffer.from(`serialized-${mockKey}`);
      const claimedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: serializedMockKey,
        nodeAccountId: '0.0.4',
      } as unknown as CachedNode;

      const nodeInfo: Partial<NodeInfoParsed> = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      };

      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: nodeInfo as NodeInfoParsed,
        etag: 'new-etag',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedNode(claimedNode);

      expect(result.status).toBe(RefreshStatus.REFRESHED);
    });

    it('should return REFRESHED when cache has no prior data (first fetch)', async () => {
      const claimedNode = {
        id: 1,
        nodeId: 1,
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: null,
        nodeAccountId: null,
      } as CachedNode;

      const nodeInfo: Partial<NodeInfoParsed> = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      };

      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: nodeInfo as NodeInfoParsed,
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedNode(claimedNode);

      expect(result.status).toBe(RefreshStatus.REFRESHED);
    });
  });

  describe('saveNodeData', () => {
    it('should save new node data with keys', async () => {
      const nodeInfo: Partial<NodeInfoParsed> = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      }

      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: nodeInfo as NodeInfoParsed,
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);
      cacheHelper.insertKeys.mockResolvedValue(undefined);

      const result = await (service as any).saveNodeData(
        1,
        'testnet',
        'token-123',
        nodeInfo as NodeInfoParsed,
        'etag-123'
      );

      expect(result).toEqual({ id: 1, nodeData: { admin_key: mockKey, node_account_id: AccountId.fromString('0.0.3') } });
      expect(serializeKey).toHaveBeenCalledWith(mockKey);
      expect(flattenKeyList).toHaveBeenCalledWith(mockKey);
      expect(cacheHelper.insertKeys).toHaveBeenCalledWith(
        CachedNodeAdminKey,
        1,
        'cachedNode',
        [mockKey]
      );
    });

    it('should return null when claim is lost', async () => {
      const nodeInfo: Partial<NodeInfoParsed> = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      }

      cacheHelper.saveAndReleaseClaim.mockResolvedValue(null);

      const result = await (service as any).saveNodeData(
        1,
        'testnet',
        'token-123',
        nodeInfo as NodeInfoParsed
      );

      expect(result).toBeNull();
    });

    it('should save without keys when no nodeData provided', async () => {
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).saveNodeData(
        1,
        'testnet',
        'token-123'
      );

      expect(result).toEqual({ id: 1 });
      expect(cacheHelper.insertKeys).not.toHaveBeenCalled();
    });

    it('should link transaction when transactionId provided', async () => {
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);
      cacheHelper.linkTransactionToEntity.mockResolvedValue(undefined);

      await (service as any).saveNodeData(
        1,
        'testnet',
        'token-123',
        undefined,
        undefined,
        999
      );

      expect(cacheHelper.linkTransactionToEntity).toHaveBeenCalledWith(
        TransactionCachedNode,
        999,
        1,
        'cachedNode'
      );
    });
  });

  describe('validateNode', () => {
    it('should accept valid node ID', () => {
      expect(() => {
        (service as any).validateNodeId(1);
      }).not.toThrow();
    });

    it('should throw for empty nodeId', () => {
      expect(() => {
        (service as any).validateNodeId(undefined);
      }).toThrow(new HttpException('Invalid node ID: must be a non-negative integer', HttpStatus.BAD_REQUEST));
      expect(() => {
        (service as any).validateNodeId(null);
      }).toThrow(new HttpException('Invalid node ID: must be a non-negative integer', HttpStatus.BAD_REQUEST));
    });

    it('should throw for non integer', () => {
      expect(() => {
        (service as any).validateNodeId(1.23);
      }).toThrow(
        new HttpException('Invalid node ID: must be a non-negative integer', HttpStatus.BAD_REQUEST)
      );
    });

    it('should throw for negative integer', () => {
      expect(() => {
        (service as any).validateNodeId(-1);
      }).toThrow(new HttpException('Invalid node ID: must be a non-negative integer', HttpStatus.BAD_REQUEST));
    });
  });

  describe('hasCompleteData', () => {
    it('should return true when nodeAccountId and encodedKey are present', () => {
      const cached = { nodeAccountId: '0.0.3', encodedKey: Buffer.from('key') } as CachedNode;
      expect((service as any).hasCompleteData(cached)).toBe(true);
    });

    it('should return false when nodeAccountId or encodedKey is missing', () => {
      const cached = {} as CachedNode;
      expect((service as any).hasCompleteData(cached)).toBe(false);
    });

    it('should return false for null cached node', () => {
      expect((service as any).hasCompleteData(null)).toBe(false);
    });
  });

  describe('parseCachedNode', () => {
    it('should parse cached node correctly', () => {
      const cached = {
        nodeAccountId: '0.0.3',
        encodedKey: Buffer.from('encoded-key'),
      } as CachedNode;

      const result = (service as any).parseCachedNode(cached);
      expect(result).toEqual({
        admin_key: 'deserialized-encoded-key',
        node_account_id: AccountId.fromString('0.0.3'),
      });
      expect(deserializeKey).toHaveBeenCalledWith(Buffer.from('encoded-key'));
    });
  });

  describe('hasNodeDataChanged', () => {
    it('should return false when fetched data matches cached data', () => {
      const serializedMockKey = Buffer.from(`serialized-${mockKey}`);
      const cached = {
        encodedKey: serializedMockKey,
        nodeAccountId: '0.0.3',
      } as unknown as CachedNode;

      const fetchedData = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      } as unknown as NodeInfoParsed;

      expect((service as any).hasNodeDataChanged(fetchedData, cached)).toBe(false);
    });

    it('should return true when admin key differs', () => {
      const otherKey = PrivateKey.generateED25519().publicKey;
      const cached = {
        encodedKey: Buffer.from(`serialized-${otherKey}`),
        nodeAccountId: '0.0.3',
      } as unknown as CachedNode;

      const fetchedData = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      } as unknown as NodeInfoParsed;

      expect((service as any).hasNodeDataChanged(fetchedData, cached)).toBe(true);
    });

    it('should return true when nodeAccountId differs', () => {
      const serializedMockKey = Buffer.from(`serialized-${mockKey}`);
      const cached = {
        encodedKey: serializedMockKey,
        nodeAccountId: '0.0.4',
      } as unknown as CachedNode;

      const fetchedData = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      } as unknown as NodeInfoParsed;

      expect((service as any).hasNodeDataChanged(fetchedData, cached)).toBe(true);
    });

    it('should return true when cache has no prior data', () => {
      const cached = {
        encodedKey: null,
        nodeAccountId: null,
      } as unknown as CachedNode;

      const fetchedData = {
        admin_key: mockKey,
        node_account_id: AccountId.fromString('0.0.3'),
      } as unknown as NodeInfoParsed;

      expect((service as any).hasNodeDataChanged(fetchedData, cached)).toBe(true);
    });
  });
});