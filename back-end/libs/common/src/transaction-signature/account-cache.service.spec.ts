import { mockDeep } from 'jest-mock-extended';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PrivateKey } from '@hiero-ledger/sdk';

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
  NatsPublisherService,
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
  let mockQueryBuilder: any;
  let dataSource: jest.Mocked<DataSource>;
  let cacheHelper: jest.Mocked<CacheHelper>;
  let configService: jest.Mocked<ConfigService>;
  let publisher: { publish: jest.Mock };

  const sqlBuilderService = mockDeep<SqlBuilderService>();

  const mockTransaction: Transaction = {
    id: 1,
    mirrorNetwork: 'testnet',
  } as Transaction;

  const mockKey = PrivateKey.generateED25519().publicKey;

  beforeEach(async () => {
    const mockManager = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    publisher = { publish: jest.fn().mockResolvedValue({ success: true }) };

    mirrorNodeClient = {
      fetchAccountInfo: jest.fn(),
    } as any;

    mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      manager: mockManager,
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as any;

    cacheHelper = {
      tryClaimRefresh: jest.fn(),
      saveAndReleaseClaim: jest.fn(),
      replaceKeys: jest.fn(),
    } as any;

    configService = {
      get: jest.fn((_key, defaultValue) => defaultValue),
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
        { provide: NatsPublisherService, useValue: publisher },
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

      const result = await service.getAccountInfoForTransaction(mockTransaction, '0.0.123');

      expect(result).toEqual({
        key: 'deserialized-encoded-key',
        receiverSignatureRequired: true,
      });
      expect(dataSource.createQueryBuilder).toHaveBeenCalled();
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

    it('should ignore duplicate transaction-account links', async () => {
      const cachedAccount = {
        id: 1,
        mirrorNetwork: 'testnet',
        account: '0.0.3',
        receiverSignatureRequired: true,
        encodedKey: Buffer.from('encoded-key'),
        updatedAt: new Date(),
      } as CachedAccount;

      dataSource.manager.findOne = jest.fn().mockResolvedValue(cachedAccount);

      await service.getAccountInfoForTransaction(mockTransaction, '0.0.3');

      expect(mockQueryBuilder.orIgnore).toHaveBeenCalled();
    });

    it('should pass isReceiver=true when account is a receiver', async () => {
      const cachedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        encodedKey: Buffer.from('encoded-key'),
        receiverSignatureRequired: true,
        updatedAt: new Date(),
      } as CachedAccount;

      dataSource.manager.findOne = jest.fn().mockResolvedValue(cachedAccount);

      await service.getAccountInfoForTransaction(mockTransaction, '0.0.123', true);

      expect(mockQueryBuilder.values).toHaveBeenCalledWith({
        transaction: { id: 1 },
        cachedAccount: { id: 1 },
        isReceiver: true,
      });
    });

    it('should default isReceiver to false when not provided', async () => {
      const cachedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        encodedKey: Buffer.from('encoded-key'),
        receiverSignatureRequired: true,
        updatedAt: new Date(),
      } as CachedAccount;

      dataSource.manager.findOne = jest.fn().mockResolvedValue(cachedAccount);

      await service.getAccountInfoForTransaction(mockTransaction, '0.0.123'); // no isReceiver arg

      expect(mockQueryBuilder.values).toHaveBeenCalledWith({
        transaction: { id: 1 },
        cachedAccount: { id: 1 },
        isReceiver: false,
      });
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

      expect(mockQueryBuilder.into).toHaveBeenCalledWith(TransactionCachedAccount);
      expect(mockQueryBuilder.values).toHaveBeenCalledWith({
        transaction: { id: 999 },
        cachedAccount: { id: 1 },
        isReceiver: false,
      });
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

      (dataSource.manager.find as jest.Mock).mockResolvedValue([{ transactionId: 11 }, { transactionId: 12 }]);

      const result = await (service as any).performRefreshForClaimedAccount(claimedAccount);

      expect(result.status).toBe(RefreshStatus.REFRESHED);
      // Previously cached data changed: the linked transactions are told the signers may have changed
      expect(dataSource.manager.find).toHaveBeenCalledWith(TransactionCachedAccount, {
        where: { cachedAccountId: 1 },
        select: { transactionId: true },
      });
      expect(publisher.publish).toHaveBeenCalledWith(expect.any(String), [
        { entityId: 11, additionalData: { signersChanged: true } },
        { entityId: 12, additionalData: { signersChanged: true } },
      ]);
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
      (dataSource.manager.find as jest.Mock).mockResolvedValue([{ transactionId: 31 }]);

      const result = await (service as any).performRefreshForClaimedAccount(claimedAccount);

      expect(result.status).toBe(RefreshStatus.REFRESHED);
      // only the receiver-signature flag changed, which also changes who must sign
      expect(publisher.publish).toHaveBeenCalledWith(expect.any(String), [
        { entityId: 31, additionalData: { signersChanged: true } },
      ]);
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
      // A first fetch is not a change, so nothing is emitted
      expect(dataSource.manager.find).not.toHaveBeenCalled();
      expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('should not emit when the data is unchanged', async () => {
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: Buffer.from(`serialized-${mockKey}`),
        receiverSignatureRequired: false,
      } as unknown as CachedAccount;
      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: { key: mockKey, receiverSignatureRequired: false } as unknown as AccountInfoParsed,
        etag: 'e',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      await (service as any).performRefreshForClaimedAccount(claimedAccount);

      expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('should not publish when a changed account has no linked transactions', async () => {
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: Buffer.from(`serialized-${PrivateKey.generateED25519().publicKey}`),
        receiverSignatureRequired: false,
      } as unknown as CachedAccount;
      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: { key: mockKey, receiverSignatureRequired: false } as unknown as AccountInfoParsed,
        etag: 'e',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);
      (dataSource.manager.find as jest.Mock).mockResolvedValue([]);

      const result = await (service as any).performRefreshForClaimedAccount(claimedAccount);

      expect(result.status).toBe(RefreshStatus.REFRESHED);
      expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('should still return REFRESHED and log when emitting the change fails', async () => {
      const claimedAccount = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: 'token-123',
        encodedKey: Buffer.from(`serialized-${PrivateKey.generateED25519().publicKey}`),
        receiverSignatureRequired: false,
      } as unknown as CachedAccount;
      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: { key: mockKey, receiverSignatureRequired: false } as unknown as AccountInfoParsed,
        etag: 'e',
      });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);
      (dataSource.manager.find as jest.Mock).mockRejectedValue(new Error('db down'));
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

      const result = await (service as any).performRefreshForClaimedAccount(claimedAccount);

      expect(result.status).toBe(RefreshStatus.REFRESHED);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('cached account 1'), expect.any(Error));
      // the refresh must not have been treated as a failure (no claim-clearing save after an error)
      expect(cacheHelper.saveAndReleaseClaim).toHaveBeenCalledTimes(1);
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
      cacheHelper.replaceKeys.mockResolvedValue(undefined);

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
      expect(cacheHelper.replaceKeys).toHaveBeenCalledWith(
        CachedAccountKey,
        1,
        'cachedAccount',
        [mockKey]
      );
    });

    it('should persist a null encodedKey (not []) for a keyless account', async () => {
      // An empty array would be serialized by pg as the text "{}" in a bytea column,
      // which later fails protobuf decoding ("index out of range: 2 + 4 > 2").
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      const result = await (service as any).saveAccountData(
        '0.0.123',
        'testnet',
        'token-123',
        { key: null, receiverSignatureRequired: false } as AccountInfoParsed,
        'etag-123',
      );

      expect(result).toEqual({
        id: 1,
        accountData: { key: null, receiverSignatureRequired: false },
      });
      expect(cacheHelper.saveAndReleaseClaim).toHaveBeenCalledWith(
        CachedAccount,
        { account: '0.0.123', mirrorNetwork: 'testnet' },
        'token-123',
        { receiverSignatureRequired: false, encodedKey: null, etag: 'etag-123' },
      );
      expect(serializeKey).not.toHaveBeenCalled();
      // Existing key rows are cleared so a previously keyed account does not keep stale keys
      expect(cacheHelper.replaceKeys).toHaveBeenCalledWith(CachedAccountKey, 1, 'cachedAccount', []);
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
      expect(cacheHelper.replaceKeys).not.toHaveBeenCalled();
    });

    it('should link transaction when transactionId provided', async () => {
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);

      await (service as any).saveAccountData(
        '0.0.123',
        'testnet',
        'token-123',
        undefined,
        undefined,
        999
      );

      expect(mockQueryBuilder.into).toHaveBeenCalledWith(TransactionCachedAccount);
      expect(mockQueryBuilder.values).toHaveBeenCalledWith({
        transaction: { id: 999 },
        cachedAccount: { id: 1 },
        isReceiver: false,
      });
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

    it('should return true for a fetched keyless account (null key, receiverSignatureRequired set)', () => {
      const cached = { encodedKey: null, receiverSignatureRequired: false } as CachedAccount;

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
