import { DataSource } from 'typeorm';
import { CacheHelper } from './cache.helper';
import { PublicKey } from '@hashgraph/sdk';
import { mockDeep } from 'jest-mock-extended';
import { SqlBuilderService } from '@app/common';
import { randomUUID } from 'node:crypto';

jest.mock('node:crypto', () => ({
  ...jest.requireActual('node:crypto'),
  randomUUID: jest.fn(),
}));

class TestCacheEntity {
  id: number;
  key: string;
  value: string;
  refreshToken: string | null;
  updatedAt: Date;
}

describe('CacheHelper', () => {
  let helper: CacheHelper;
  let dataSource: jest.Mocked<DataSource>;
  let qb: any;
  let mockQuery: jest.Mock;
  let mockFindOne: jest.Mock;

  const sqlBuilderService = mockDeep<SqlBuilderService>();

  beforeEach(() => {
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
      cb();
      return 0 as any;
    });

    mockQuery = jest.fn();
    mockFindOne = jest.fn();

    qb = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };

    dataSource = {
      createQueryBuilder: jest.fn(() => qb),
      manager: {
        findOne: mockFindOne,
      },
      query: mockQuery,
    } as any;

    helper = new CacheHelper(dataSource);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('tryClaimRefresh', () => {
    describe('successful claim scenarios', () => {
      it('should claim a new row on first attempt (INSERT path)', async () => {
        const key = { account: '0.0.123', mirrorNetwork: 'testnet' };
        const reclaimAfterMs = 60000;
        const mockUuid = 'test-uuid-123';

        (randomUUID as jest.Mock).mockReturnValue(mockUuid);

        (dataSource.query as jest.Mock)
          .mockResolvedValueOnce([
          {
            id: 1,
            key: 'test-key',
            value: 'some-value',
            refreshToken: mockUuid,
            updatedAt: new Date(),
          },
        ]);

        const result = await helper.tryClaimRefresh(
          sqlBuilderService,
          TestCacheEntity,
          key,
          reclaimAfterMs,
        );

        expect(result.claimed).toBe(true);
        expect(result.data.refreshToken).toBe(mockUuid);
        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(mockFindOne).not.toHaveBeenCalled();
      });

      it('should claim an unclaimed existing row (UPDATE path)', async () => {
        const key = { account: '0.0.123', mirrorNetwork: 'testnet' };
        const reclaimAfterMs = 60000;
        const mockUuid = 'test-uuid-456';

        (randomUUID as jest.Mock).mockReturnValue(mockUuid);

        mockQuery.mockResolvedValue([
          {
            id: 2,
            key: 'test-key',
            value: 'existing-value',
            refreshToken: mockUuid,
            updatedAt: new Date(),
          },
        ]);

        const result = await helper.tryClaimRefresh(
          sqlBuilderService,
          TestCacheEntity,
          key,
          reclaimAfterMs,
        );

        expect(result.claimed).toBe(true);
        expect(result.data.refreshToken).toBe(mockUuid);
      });

      it('should reclaim a stale row (beyond reclaimAfterMs)', async () => {
        const key = { account: '0.0.123', mirrorNetwork: 'testnet' };
        const reclaimAfterMs = 60000;
        const mockUuid = 'test-uuid-789';

        (randomUUID as jest.Mock).mockReturnValue(mockUuid);

        // Simulate reclaiming from a stale claim
        mockQuery.mockResolvedValue([
          {
            id: 3,
            key: 'test-key',
            value: 'stale-value',
            refreshToken: mockUuid,
            updatedAt: new Date(Date.now() - reclaimAfterMs - 1000), // Stale
          },
        ]);

        const result = await helper.tryClaimRefresh(
          sqlBuilderService,
          TestCacheEntity,
          key,
          reclaimAfterMs,
        );

        expect(result.claimed).toBe(true);
        expect(result.data.refreshToken).toBe(mockUuid);
        expect(mockQuery).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([
            '0.0.123',
            'testnet',
            mockUuid,
            expect.any(Date), // reclaim cutoff
          ]),
        );
      });
    });

    describe('retry and backoff scenarios', () => {
      it('should retry and eventually find unclaimed row', async () => {
        const key = { account: '0.0.123', mirrorNetwork: 'testnet' };
        const reclaimAfterMs = 60000;

        // First attempt: someone else claimed it
        mockQuery.mockResolvedValueOnce([
          {
            id: 4,
            key: 'test-key',
            refreshToken: 'other-uuid',
            updatedAt: new Date(),
          },
        ]);

        // Second attempt: check finds it's now unclaimed
        mockFindOne.mockResolvedValueOnce({
          id: 4,
          key: 'test-key',
          value: 'completed-value',
          refreshToken: null,
          updatedAt: new Date(),
        });

        const result = await helper.tryClaimRefresh(
          sqlBuilderService,
          TestCacheEntity,
          key,
          reclaimAfterMs,
        );

        expect(result.claimed).toBe(false);
        expect(result.data.refreshToken).toBeNull();
        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(mockFindOne).toHaveBeenCalledTimes(1);
      });

      it('should retry multiple times before finding unclaimed row', async () => {
        const key = { account: '0.0.123', mirrorNetwork: 'testnet' };
        const reclaimAfterMs = 60000;

        // claimed by other
        mockQuery.mockResolvedValue([
          { id: 5, refreshToken: 'other-1', updatedAt: new Date() },
        ]);

        // Retries 1-3: still claimed
        mockFindOne
          .mockResolvedValueOnce({ id: 5, refreshToken: 'other-1', updatedAt: new Date() })
          .mockResolvedValueOnce({ id: 5, refreshToken: 'other-1', updatedAt: new Date() })
          .mockResolvedValueOnce({ id: 5, refreshToken: 'other-1', updatedAt: new Date() })
          // Retry 4: finally unclaimed
          .mockResolvedValueOnce({ id: 5, refreshToken: null, value: 'done', updatedAt: new Date() });

        const result = await helper.tryClaimRefresh(
          sqlBuilderService,
          TestCacheEntity,
          key,
          reclaimAfterMs,
        );

        expect(result.claimed).toBe(false);
        expect(result.data.refreshToken).toBeNull();
        expect(mockFindOne).toHaveBeenCalledTimes(4);
      });

      it('should attempt UPSERT again if row disappears during retry', async () => {
        const key = { account: '0.0.123', mirrorNetwork: 'testnet' };
        const reclaimAfterMs = 60000;
        const mockUuid = 'test-uuid-abc';

        (randomUUID as jest.Mock).mockReturnValue(mockUuid);

        // First attempt: claimed by other
        mockQuery.mockResolvedValueOnce([
          { id: 6, refreshToken: 'other-uuid', updatedAt: new Date() },
        ]);

        // Retry 1: row not found (deleted?)
        mockFindOne.mockResolvedValueOnce(null);

        // Retry 1 UPSERT: we claim it
        mockQuery.mockResolvedValueOnce([
          { id: 7, refreshToken: mockUuid, updatedAt: new Date() },
        ]);

        const result = await helper.tryClaimRefresh(
          sqlBuilderService,
          TestCacheEntity,
          key,
          reclaimAfterMs,
        );

        expect(result.claimed).toBe(true);
        expect(result.data.refreshToken).toBe(mockUuid);
        expect(mockQuery).toHaveBeenCalledTimes(2);
        expect(mockFindOne).toHaveBeenCalledTimes(1);
      });
    });

    describe('error scenarios', () => {
      it('should throw if query returns no rows', async () => {
        const key = { account: '0.0.123', mirrorNetwork: 'testnet' };
        const reclaimAfterMs = 60000;

        mockQuery.mockResolvedValue([]);

        await expect(
          helper.tryClaimRefresh(sqlBuilderService, TestCacheEntity, key, reclaimAfterMs),
        ).rejects.toThrow('Unexpected number of rows returned from cache upsert/claim');
      });

      it('should throw if query returns multiple rows', async () => {
        const key = { account: '0.0.123', mirrorNetwork: 'testnet' };
        const reclaimAfterMs = 60000;

        mockQuery.mockResolvedValue([
          { id: 1, refreshToken: 'uuid-1' },
          { id: 2, refreshToken: 'uuid-2' },
        ]);

        await expect(
          helper.tryClaimRefresh(sqlBuilderService, TestCacheEntity, key, reclaimAfterMs),
        ).rejects.toThrow('Unexpected number of rows returned from cache upsert/claim');
      });

      it('should throw if query returns non-array', async () => {
        const key = { account: '0.0.123', mirrorNetwork: 'testnet' };
        const reclaimAfterMs = 60000;

        mockQuery.mockResolvedValue({ id: 1 }); // Not an array

        await expect(
          helper.tryClaimRefresh(sqlBuilderService, TestCacheEntity, key, reclaimAfterMs),
        ).rejects.toThrow('Unexpected number of rows returned from cache upsert/claim');
      });

      it('should throw after max attempts with no existing data', async () => {
        const key = { account: '0.0.123', mirrorNetwork: 'testnet' };
        const reclaimAfterMs = 10000;

        // All attempts: claimed by others
        mockQuery.mockResolvedValue([
          { id: 8, refreshToken: 'other-uuid', updatedAt: new Date() },
        ]);

        mockFindOne.mockResolvedValue(null);

        await expect(
          helper.tryClaimRefresh(sqlBuilderService, TestCacheEntity, key, reclaimAfterMs),
        ).rejects.toThrow('Failed to claim cache refresh after max attempts, and no existing data found');

        expect(mockQuery).toHaveBeenCalledTimes(20);
        expect(mockFindOne).toHaveBeenCalledTimes(19); // maxAttempts-1 as it skips it in the first loop
      });

      it('should return last known data after max attempts if existing data found', async () => {
        const key = { account: '0.0.123', mirrorNetwork: 'testnet' };
        const reclaimAfterMs = 60000;

        const lastKnownData = {
          id: 9,
          key: 'test-key',
          value: 'last-value',
          refreshToken: 'other-uuid',
          updatedAt: new Date(),
        };

        // All attempts: claimed by others
        mockQuery.mockResolvedValue([lastKnownData]);
        mockFindOne.mockResolvedValue(lastKnownData);

        const result = await helper.tryClaimRefresh(
          sqlBuilderService,
          TestCacheEntity,
          key,
          reclaimAfterMs,
        );

        expect(result.claimed).toBe(false);
        expect(result.data).toEqual(lastKnownData);
      });
    });

    describe('concurrency', () => {
      it('should generate unique UUID for each call', async () => {
        const key = { account: '0.0.123', mirrorNetwork: 'testnet' };
        const reclaimAfterMs = 60000;

        const uuidSpy = randomUUID as jest.Mock;

        mockQuery.mockResolvedValue([
          { id: 11, refreshToken: 'test-uuid', updatedAt: new Date() },
        ]);

        await helper.tryClaimRefresh(sqlBuilderService, TestCacheEntity, key, reclaimAfterMs);

        expect(uuidSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('saveAndReleaseClaim', () => {
    const entity = {} as any;

    it('returns id when claim is successfully released', async () => {
      qb.execute.mockResolvedValue({
        affected: 1,
        raw: [{ id: 10 }],
      });

      const result = await helper.saveAndReleaseClaim(
        entity,
        { id: 10 },
        'token',
        { foo: 'bar' },
      );

      expect(result).toBe(10);
    });

    it('returns null when claim is lost', async () => {
      qb.execute.mockResolvedValue({
        affected: 0,
        raw: [],
      });

      const result = await helper.saveAndReleaseClaim(
        entity,
        { id: 10 },
        'token',
        { foo: 'bar' },
      );

      expect(result).toBeNull();
    });
  });

  describe('insertKeys', () => {
    const keyEntity = {} as any;

    it('does nothing when keys array is empty', async () => {
      await helper.insertKeys(keyEntity, 1, 'account', []);

      expect(dataSource.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('inserts keys when provided', async () => {
      const key = {
        toStringRaw: jest.fn(() => 'raw-key'),
      } as unknown as PublicKey;

      qb.execute.mockResolvedValue({});

      await helper.insertKeys(keyEntity, 1, 'account', [key]);

      expect(qb.values).toHaveBeenCalledWith([
        {
          account: { id: 1 },
          publicKey: 'raw-key',
        },
      ]);
    });
  });

  describe('linkTransactionToEntity', () => {
    it('links transaction to entity idempotently', async () => {
      qb.execute.mockResolvedValue({});

      await helper.linkTransactionToEntity(
        {} as any,
        5,
        9,
        'node',
      );

      expect(qb.values).toHaveBeenCalledWith({
        transaction: { id: 5 },
        node: { id: 9 },
      });
    });
  });
});