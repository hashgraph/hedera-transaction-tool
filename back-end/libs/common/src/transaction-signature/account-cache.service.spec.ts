import { mockDeep } from 'jest-mock-extended';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PrivateKey } from '@hashgraph/sdk';

import { AccountCacheService } from './account-cache.service';
import { MirrorNodeClient } from './mirror-node.client';
import { CacheHelper } from './cache.helper';
import { RefreshStatus } from '.';
import {
  CachedAccount,
  CachedAccountKey,
  Transaction,
  TransactionCachedAccount,
} from '@entities';
import {
  serializeKey,
  deserializeKey,
  flattenKeyList,
  AccountInfoParsed,
  SqlBuilderService,
} from '@app/common';

jest.mock('@app/common', () => ({
  ...jest.requireActual('@app/common'),
  serializeKey: jest.fn((key) => Buffer.from(`serialized-${key}`)),
  deserializeKey: jest.fn((encoded) => `deserialized-${encoded}`),
  flattenKeyList: jest.fn((key) => [key]),
}));

describe('AccountCacheService', () => {
  let service: AccountCacheService;
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
      fetchAccountInfo: jest.fn(),
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
        AccountCacheService,
        { provide: MirrorNodeClient, useValue: mirrorNodeClient },
        {
          provide: 'cacheDataSource',
          useValue: dataSource,
        },
        { provide: ConfigService, useValue: configService },
        { provide: SqlBuilderService, useValue: sqlBuilderService },
      ],
    }).compile();

    service = module.get<AccountCacheService>(AccountCacheService);
    // Inject the mock cacheHelper
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

  describe('refreshAccount', () => {
    it('should return true when account is successfully refreshed', async () => {
      const cachedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedAccount;
      const accountInfo: Partial<AccountInfoParsed> = {
        key: mockKey,
        receiverSignatureRequired: false,
      };

      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: cachedAccount, claimed: true });
      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: accountInfo as AccountInfoParsed,
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await service.refreshAccount(cachedAccount);

      expect(result).toBe(true);
      expect(cacheHelper.tryClaimRefresh).toHaveBeenCalledWith(
        sqlBuilderService,
        CachedAccount,
        { account: '0.0.123', mirrorNetwork: 'testnet' },
        10000
      );
    });

    it('should return false when account is already being refreshed', async () => {
      const cachedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
      } as CachedAccount;

      const claimedAccount = {
        ...cachedAccount,
        refreshToken: null,
      } as CachedAccount;

      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: claimedAccount, claimed: false });

      const result = await service.refreshAccount(cachedAccount);

      expect(result).toBe(false);
      expect(mirrorNodeClient.fetchAccountInfo).not.toHaveBeenCalled();
    });

    it('should return false when refresh status is NOT_MODIFIED', async () => {
      const cachedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: Buffer.from('encoded-key'),
        receiverSignatureRequired: false,
      } as CachedAccount;

      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: cachedAccount, claimed: true });
      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: null, // 304 Not Modified
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await service.refreshAccount(cachedAccount);

      expect(result).toBe(false);
    });

    it('should return false when refresh status is NOT_FOUND', async () => {
      const cachedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedAccount;

      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: cachedAccount, claimed: false });
      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: null,
        etag: null,
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await service.refreshAccount(cachedAccount);

      expect(result).toBe(false);
    });

    it('should return false when HTTP 200 but data is identical to cached', async () => {
      const serializedMockKey = Buffer.from(`serialized-${mockKey}`);
      const cachedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: serializedMockKey,
        receiverSignatureRequired: false,
      } as unknown as CachedAccount;

      const accountInfo: Partial<AccountInfoParsed> = {
        key: mockKey,
        receiverSignatureRequired: false,
      };

      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: cachedAccount, claimed: true });
      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: accountInfo as AccountInfoParsed,
        etag: 'new-etag',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await service.refreshAccount(cachedAccount);

      expect(result).toBe(false);
    });
  });

  describe('getAccountInfoForTransaction', () => {
    it('should return null when transaction is null', async () => {
      const result = await service.getAccountInfoForTransaction(null as any, '0.0.123');
      expect(result).toBeNull();
    });

    it('should return null when transaction has no mirrorNetwork', async () => {
      const tx = { id: 1 } as Transaction;
      const result = await service.getAccountInfoForTransaction(tx, '0.0.123');
      expect(result).toBeNull();
    });

    it('should throw error for invalid account (not a string)', async () => {
      await expect(
        service.getAccountInfoForTransaction(mockTransaction, null as any)
      ).rejects.toThrow(new HttpException('Invalid account ID', HttpStatus.BAD_REQUEST));
    });

    it('should throw error for invalid account format', async () => {
      await expect(
        service.getAccountInfoForTransaction(mockTransaction, 'invalid')
      ).rejects.toThrow(
        new HttpException('Account ID must be in format: shard.realm.num', HttpStatus.BAD_REQUEST)
      );
    });

    it('should return cached data when fresh and complete', async () => {
      const cachedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        encodedKey: Buffer.from('encoded-key'),
        receiverSignatureRequired: true,
        updatedAt: new Date(),
      } as CachedAccount;

      dataSource.manager.findOne = jest.fn().mockResolvedValue(cachedAccount);
      cacheHelper.linkTransactionToEntity.mockResolvedValue(undefined);

      const result = await service.getAccountInfoForTransaction(mockTransaction, '0.0.123');

      expect(result).toEqual({
        key: 'deserialized-encoded-key',
        receiverSignatureRequired: true,
      });
      expect(cacheHelper.linkTransactionToEntity).toHaveBeenCalledWith(
        TransactionCachedAccount,
        1,
        1,
        'cachedAccount'
      );
    });

    it('should fetch new data when cache is stale', async () => {
      const staleDate = new Date(Date.now() - 20000); // 20 seconds ago
      const cachedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        encodedKey: Buffer.from('old-key'),
        updatedAt: staleDate,
        refreshToken: 'token-123',
      } as CachedAccount;
      const accountInfo: Partial<AccountInfoParsed> = {
        key: mockKey,
        receiverSignatureRequired: false,
      }

      dataSource.manager.findOne = jest.fn().mockResolvedValue(cachedAccount);
      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: cachedAccount, claimed: true });
      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: accountInfo as AccountInfoParsed,
        etag: 'new-etag',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await service.getAccountInfoForTransaction(mockTransaction, '0.0.123');

      expect(result).toEqual({
        key: mockKey,
        receiverSignatureRequired: false,
      });
    });

    it('should fetch new data when cache is missing', async () => {
      dataSource.manager.findOne = jest.fn().mockResolvedValue(null);

      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedAccount;
      const accountInfo: Partial<AccountInfoParsed> = {
        key: mockKey,
        receiverSignatureRequired: false,
      }

      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: claimedAccount, claimed: true });
      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: accountInfo as AccountInfoParsed,
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await service.getAccountInfoForTransaction(mockTransaction, '0.0.123');

      expect(result).toEqual({
        key: mockKey,
        receiverSignatureRequired: false,
      });
    });

    it('should return cached data when another process is refreshing', async () => {
      const cachedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        encodedKey: Buffer.from('encoded-key'),
        receiverSignatureRequired: true,
        updatedAt: new Date(Date.now() - 20000),
      } as CachedAccount;

      const claimedAccount = {
        ...cachedAccount,
        refreshToken: null, // Already being refreshed
      };

      dataSource.manager.findOne = jest.fn().mockResolvedValue(cachedAccount);
      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: claimedAccount, claimed: false });
      cacheHelper.linkTransactionToEntity.mockResolvedValue(undefined);

      const result = await service.getAccountInfoForTransaction(mockTransaction, '0.0.123');

      expect(result).toEqual({
        key: 'deserialized-encoded-key',
        receiverSignatureRequired: true,
      });
    });

    it('should return null when another process is refreshing and no cached data exists', async () => {
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: null, // Already being refreshed
        encodedKey: null, // No data
      } as CachedAccount;

      dataSource.manager.findOne = jest.fn().mockResolvedValue(null);
      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: claimedAccount, claimed: false });

      const result = await service.getAccountInfoForTransaction(mockTransaction, '0.0.123');

      expect(result).toBeNull();
    });
  });

  describe('performRefreshForClaimedAccount', () => {
    it('should return REFRESHED status with new data', async () => {
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedAccount;
      const accountInfo: Partial<AccountInfoParsed> = {
        key: mockKey,
        receiverSignatureRequired: false,
      }

      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: accountInfo as AccountInfoParsed,
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedAccount(claimedAccount);

      expect(result.status).toBe(RefreshStatus.REFRESHED);
      expect(result.data).toEqual({
        key: mockKey,
        receiverSignatureRequired: false,
      });
    });

    it('should return NOT_MODIFIED status with cached data on 304', async () => {
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: Buffer.from('encoded-key'),
        receiverSignatureRequired: true,
      } as CachedAccount;

      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: null, // 304
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedAccount(claimedAccount);

      expect(result.status).toBe(RefreshStatus.NOT_MODIFIED);
      expect(result.data).toEqual({
        key: 'deserialized-encoded-key',
        receiverSignatureRequired: true,
      });
    });

    it('should return NOT_FOUND status when account not found', async () => {
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedAccount;

      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: null,
        etag: null,
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedAccount(claimedAccount);

      expect(result.status).toBe(RefreshStatus.NOT_FOUND);
      expect(result.data).toBeNull();
    });

    it('should clear refresh token and rethrow on error', async () => {
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedAccount;

      const error = new Error('Network error');
      mirrorNodeClient.fetchAccountInfo.mockRejectedValue(error);
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      await expect(
        (service as any).performRefreshForClaimedAccount(claimedAccount)
      ).rejects.toThrow('Network error');

      expect(cacheHelper.saveAndReleaseClaim).toHaveBeenCalledWith(
        CachedAccount,
        { account: '0.0.123', mirrorNetwork: 'testnet' },
        'token-123',
        {}
      );
    });

    it('should log error when clearing refresh token fails after error', async () => {
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedAccount;

      const fetchError = new Error('Network error');
      const saveError = new Error('Save error');

      mirrorNodeClient.fetchAccountInfo.mockRejectedValue(fetchError);
      cacheHelper.saveAndReleaseClaim.mockRejectedValue(saveError);

      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await expect(
        (service as any).performRefreshForClaimedAccount(claimedAccount)
      ).rejects.toThrow('Network error');

      expect(loggerSpy).toHaveBeenCalledWith('Failed to clear refresh token after error', saveError);
    });

    it('should link transaction when transactionId provided', async () => {
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
      } as CachedAccount;

      const accountInfo: Partial<AccountInfoParsed> = {
        key: mockKey,
        receiverSignatureRequired: false,
      }

      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: accountInfo as AccountInfoParsed,
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      await (service as any).performRefreshForClaimedAccount(claimedAccount, 999);

      expect(cacheHelper.linkTransactionToEntity).toHaveBeenCalledWith(
        TransactionCachedAccount,
        999,
        1,
        'cachedAccount'
      );
    });

    it('should return DATA_UNCHANGED when fetched data matches cached data', async () => {
      const serializedMockKey = Buffer.from(`serialized-${mockKey}`);
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: serializedMockKey,
        receiverSignatureRequired: false,
      } as unknown as CachedAccount;

      const accountInfo: Partial<AccountInfoParsed> = {
        key: mockKey,
        receiverSignatureRequired: false,
      };

      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: accountInfo as AccountInfoParsed,
        etag: 'new-etag',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedAccount(claimedAccount);

      expect(result.status).toBe(RefreshStatus.DATA_UNCHANGED);
      expect(result.data).toEqual({
        key: mockKey,
        receiverSignatureRequired: false,
      });
    });

    it('should return REFRESHED when key differs', async () => {
      const otherKey = PrivateKey.generateED25519().publicKey;
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: Buffer.from(`serialized-${otherKey}`),
        receiverSignatureRequired: false,
      } as unknown as CachedAccount;

      const accountInfo: Partial<AccountInfoParsed> = {
        key: mockKey,
        receiverSignatureRequired: false,
      };

      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: accountInfo as AccountInfoParsed,
        etag: 'new-etag',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedAccount(claimedAccount);

      expect(result.status).toBe(RefreshStatus.REFRESHED);
    });

    it('should return REFRESHED when receiverSignatureRequired differs', async () => {
      const serializedMockKey = Buffer.from(`serialized-${mockKey}`);
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: serializedMockKey,
        receiverSignatureRequired: true,
      } as unknown as CachedAccount;

      const accountInfo: Partial<AccountInfoParsed> = {
        key: mockKey,
        receiverSignatureRequired: false,
      };

      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: accountInfo as AccountInfoParsed,
        etag: 'new-etag',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedAccount(claimedAccount);

      expect(result.status).toBe(RefreshStatus.REFRESHED);
    });

    it('should return REFRESHED when cache has no prior data (first fetch)', async () => {
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: null,
      } as CachedAccount;

      const accountInfo: Partial<AccountInfoParsed> = {
        key: mockKey,
        receiverSignatureRequired: false,
      };

      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: accountInfo as AccountInfoParsed,
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).performRefreshForClaimedAccount(claimedAccount);

      expect(result.status).toBe(RefreshStatus.REFRESHED);
    });
  });

  describe('saveAccountData', () => {
    it('should save new account data with keys', async () => {
      const accountInfo: Partial<AccountInfoParsed> = {
        key: mockKey,
        receiverSignatureRequired: false,
      }

      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: accountInfo as AccountInfoParsed,
        etag: 'etag-123',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);
      cacheHelper.insertKeys.mockResolvedValue(undefined);

      const result = await (service as any).saveAccountData(
        '0.0.123',
        'testnet',
        'token-123',
        accountInfo as AccountInfoParsed,
        'etag-123'
      );

      expect(result).toEqual({ id: 1, accountData: { key: mockKey, receiverSignatureRequired: false } });
      expect(serializeKey).toHaveBeenCalledWith(mockKey);
      expect(flattenKeyList).toHaveBeenCalledWith(mockKey);
      expect(cacheHelper.insertKeys).toHaveBeenCalledWith(
        CachedAccountKey,
        1,
        'cachedAccount',
        [mockKey]
      );
    });

    it('should return null when claim is lost', async () => {
      const accountInfo: Partial<AccountInfoParsed> = {
        key: mockKey,
      }

      cacheHelper.saveAndReleaseClaim.mockResolvedValue(null);

      const result = await (service as any).saveAccountData(
        '0.0.123',
        'testnet',
        'token-123',
        accountInfo as AccountInfoParsed
      );

      expect(result).toBeNull();
    });

    it('should save without keys when no accountData provided', async () => {
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).saveAccountData(
        '0.0.123',
        'testnet',
        'token-123'
      );

      expect(result).toEqual({ id: 1 });
      expect(cacheHelper.insertKeys).not.toHaveBeenCalled();
    });

    it('should link transaction when transactionId provided', async () => {
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);
      cacheHelper.linkTransactionToEntity.mockResolvedValue(undefined);

      await (service as any).saveAccountData(
        '0.0.123',
        'testnet',
        'token-123',
        undefined,
        undefined,
        999
      );

      expect(cacheHelper.linkTransactionToEntity).toHaveBeenCalledWith(
        TransactionCachedAccount,
        999,
        1,
        'cachedAccount'
      );
    });
  });

  describe('validateAccount', () => {
    it('should accept valid account ID', () => {
      expect(() => {
        (service as any).validateAccount('0.0.123');
      }).not.toThrow();
    });

    it('should throw for empty account', () => {
      expect(() => {
        (service as any).validateAccount('');
      }).toThrow(new HttpException('Invalid account ID', HttpStatus.BAD_REQUEST));
    });

    it('should throw for non-string account', () => {
      expect(() => {
        (service as any).validateAccount(123 as any);
      }).toThrow(new HttpException('Invalid account ID', HttpStatus.BAD_REQUEST));
    });

    it('should throw for invalid format', () => {
      expect(() => {
        (service as any).validateAccount('invalid');
      }).toThrow(
        new HttpException('Account ID must be in format: shard.realm.num', HttpStatus.BAD_REQUEST)
      );
    });

    it('should throw for missing parts', () => {
      expect(() => {
        (service as any).validateAccount('0.0');
      }).toThrow(
        new HttpException('Account ID must be in format: shard.realm.num', HttpStatus.BAD_REQUEST)
      );
    });
  });

  describe('hasCompleteData', () => {
    it('should return true when encodedKey is present', () => {
      const cached = {
        encodedKey: Buffer.from('encoded-key'),
      } as CachedAccount;

      expect((service as any).hasCompleteData(cached)).toBe(true);
    });

    it('should return false when encodedKey is missing', () => {
      const cached = {} as CachedAccount;
      expect((service as any).hasCompleteData(cached)).toBe(false);
    });

    it('should return false for null cached account', () => {
      expect((service as any).hasCompleteData(null)).toBe(false);
    });
  });

  describe('parseCachedAccount', () => {
    it('should parse cached account correctly', () => {
      const cached = {
        encodedKey: Buffer.from('encoded-key'),
        receiverSignatureRequired: true,
      } as CachedAccount;

      const result = (service as any).parseCachedAccount(cached);

      expect(result).toEqual({
        key: 'deserialized-encoded-key',
        receiverSignatureRequired: true,
      });
      expect(deserializeKey).toHaveBeenCalledWith(Buffer.from('encoded-key'));
    });
  });

  describe('hasAccountDataChanged', () => {
    it('should return false when fetched data matches cached data', () => {
      const serializedMockKey = Buffer.from(`serialized-${mockKey}`);
      const cached = {
        encodedKey: serializedMockKey,
        receiverSignatureRequired: false,
      } as unknown as CachedAccount;

      const fetchedData = {
        key: mockKey,
        receiverSignatureRequired: false,
      } as unknown as AccountInfoParsed;

      expect((service as any).hasAccountDataChanged(fetchedData, cached)).toBe(false);
    });

    it('should return true when key differs', () => {
      const otherKey = PrivateKey.generateED25519().publicKey;
      const cached = {
        encodedKey: Buffer.from(`serialized-${otherKey}`),
        receiverSignatureRequired: false,
      } as unknown as CachedAccount;

      const fetchedData = {
        key: mockKey,
        receiverSignatureRequired: false,
      } as unknown as AccountInfoParsed;

      expect((service as any).hasAccountDataChanged(fetchedData, cached)).toBe(true);
    });

    it('should return true when receiverSignatureRequired differs', () => {
      const serializedMockKey = Buffer.from(`serialized-${mockKey}`);
      const cached = {
        encodedKey: serializedMockKey,
        receiverSignatureRequired: true,
      } as unknown as CachedAccount;

      const fetchedData = {
        key: mockKey,
        receiverSignatureRequired: false,
      } as unknown as AccountInfoParsed;

      expect((service as any).hasAccountDataChanged(fetchedData, cached)).toBe(true);
    });

    it('should return true when cache has no prior data', () => {
      const cached = {
        encodedKey: null,
      } as CachedAccount;

      const fetchedData = {
        key: mockKey,
        receiverSignatureRequired: false,
      } as unknown as AccountInfoParsed;

      expect((service as any).hasAccountDataChanged(fetchedData, cached)).toBe(true);
    });
  });
});