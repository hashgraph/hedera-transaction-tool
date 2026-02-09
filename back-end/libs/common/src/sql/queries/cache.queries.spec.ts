import { DataSource } from 'typeorm';
import { CachedAccount, CachedNode } from '@entities';
import { createTestPostgresDataSource } from '../../../../../test-utils/postgres-test-db';
import { getUpsertRefreshTokenForCacheQuery, SqlBuilderService } from '@app/common';
import { randomUUID } from 'node:crypto';

describe('getUpsertRefreshTokenForCacheQuery - Integration', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  let sqlBuilder: SqlBuilderService;

  beforeAll(async () => {
    const testDb = await createTestPostgresDataSource();
    dataSource = testDb.dataSource;
    cleanup = testDb.cleanup;
    sqlBuilder = new SqlBuilderService(dataSource.manager);
  }, 60000);

  afterAll(async () => {
    await cleanup();
  });

  afterEach(async () => {
    await dataSource.getRepository(CachedNode).delete({});
    await dataSource.getRepository(CachedAccount).delete({});
  });

  describe('INSERT path - new records', () => {
    it('should insert new record with refresh token', async () => {
      const query = getUpsertRefreshTokenForCacheQuery(
        sqlBuilder,
        CachedAccount,
        ['account', 'mirrorNetwork'],
      );

      const refreshToken = randomUUID();
      const reclaimDate = new Date(Date.now() - 60000);

      const result = await dataSource.query(query, [
        '0.0.100',
        'mainnet',
        refreshToken,
        reclaimDate,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].account).toBe('0.0.100');
      expect(result[0].mirrorNetwork).toBe('mainnet');
      expect(result[0].refreshToken).toBe(refreshToken);
      expect(result[0].createdAt).toBeDefined();
      expect(result[0].updatedAt).toBeDefined();
    });

    it('should insert record with single key column', async () => {
      const query = getUpsertRefreshTokenForCacheQuery(
        sqlBuilder,
        CachedNode,
        ['nodeId', 'mirrorNetwork'],
      );

      const refreshToken = randomUUID();
      const reclaimDate = new Date(Date.now() - 60000);

      const result = await dataSource.query(query, [
        1,
        'mainnet',
        refreshToken,
        reclaimDate,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].nodeId).toBe(1);
      expect(result[0].mirrorNetwork).toBe('mainnet');
      expect(result[0].refreshToken).toBe(refreshToken);
    });
  });

  describe('UPDATE path - claiming unclaimed records', () => {
    it('should claim unclaimed existing record', async () => {
      // First, create an unclaimed record
      await dataSource.getRepository(CachedAccount).save({
        account: '0.0.200',
        mirrorNetwork: 'testnet',
        refreshToken: null,
      });

      const query = getUpsertRefreshTokenForCacheQuery(
        sqlBuilder,
        CachedAccount,
        ['account', 'mirrorNetwork'],
      );

      const refreshToken = randomUUID();
      const reclaimDate = new Date(Date.now() - 60000);

      const result = await dataSource.query(query, [
        '0.0.200',
        'testnet',
        refreshToken,
        reclaimDate,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].account).toBe('0.0.200');
      expect(result[0].refreshToken).toBe(refreshToken);
    });

    it('should reclaim stale record (updatedAt < reclaimDate)', async () => {
      const staleDate = new Date(Date.now() - 120000); // 2 minutes ago
      const oldToken = randomUUID();

      await dataSource.getRepository(CachedAccount).save({
        account: '0.0.300',
        mirrorNetwork: 'mainnet',
        refreshToken: oldToken,
        updatedAt: staleDate,
      });

      const query = getUpsertRefreshTokenForCacheQuery(
        sqlBuilder,
        CachedAccount,
        ['account', 'mirrorNetwork'],
      );

      const newRefreshToken = randomUUID();
      const reclaimDate = new Date(Date.now() - 60000); // 1 minute ago

      const result = await dataSource.query(query, [
        '0.0.300',
        'mainnet',
        newRefreshToken,
        reclaimDate,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].refreshToken).toBe(newRefreshToken);
    });
  });

  describe('UNION path - returning existing claimed records', () => {
    it('should return existing record without updating when already claimed and fresh', async () => {
      const recentDate = new Date(Date.now() - 10000); // 10 seconds ago
      const oldToken = randomUUID();

      await dataSource.getRepository(CachedAccount).save({
        account: '0.0.400',
        mirrorNetwork: 'mainnet',
        refreshToken: oldToken,
        updatedAt: recentDate,
      });

      const query = getUpsertRefreshTokenForCacheQuery(
        sqlBuilder,
        CachedAccount,
        ['account', 'mirrorNetwork'],
      );

      const attemptedToken = randomUUID();
      const reclaimDate = new Date(Date.now() - 60000); // 1 minute ago

      const result = await dataSource.query(query, [
        '0.0.400',
        'mainnet',
        attemptedToken,
        reclaimDate,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].account).toBe('0.0.400');
      expect(result[0].refreshToken).toBe(oldToken); // NOT the attempted token
    });

    it('should return current owner when claim fails', async () => {
      const recentDate = new Date();
      const oldToken = randomUUID();

      await dataSource.getRepository(CachedAccount).save({
        account: '0.0.500',
        mirrorNetwork: 'testnet',
        refreshToken: oldToken,
        updatedAt: recentDate,
      });

      const query = getUpsertRefreshTokenForCacheQuery(
        sqlBuilder,
        CachedAccount,
        ['account', 'mirrorNetwork'],
      );

      const attemptedToken = randomUUID();
      const reclaimDate = new Date(Date.now() - 60000);

      const result = await dataSource.query(query, [
        '0.0.500',
        'testnet',
        attemptedToken,
        reclaimDate,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].refreshToken).toBe(oldToken);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple key columns correctly', async () => {
      const query = getUpsertRefreshTokenForCacheQuery(
        sqlBuilder,
        CachedAccount,
        ['account', 'mirrorNetwork'],
      );

      const refreshToken = randomUUID();
      const reclaimDate = new Date(Date.now() - 60000);

      const result = await dataSource.query(query, [
        '0.0.600',
        'previewnet',
        refreshToken,
        reclaimDate,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].account).toBe('0.0.600');
      expect(result[0].mirrorNetwork).toBe('previewnet');
      expect(result[0].refreshToken).toBe(refreshToken);
    });

    it('should only return one row (LIMIT 1)', async () => {
      // This test ensures the LIMIT 1 works in the UNION
      await dataSource.getRepository(CachedAccount).save({
        account: '0.0.700',
        mirrorNetwork: 'mainnet',
        refreshToken: randomUUID(),
      });

      const query = getUpsertRefreshTokenForCacheQuery(
        sqlBuilder,
        CachedAccount,
        ['account', 'mirrorNetwork'],
      );

      const result = await dataSource.query(query, [
        '0.0.700',
        'mainnet',
        randomUUID(),
        new Date(Date.now() - 60000),
      ]);

      expect(result).toHaveLength(1);
    });

    it('should set timestamps correctly on insert', async () => {
      const query = getUpsertRefreshTokenForCacheQuery(
        sqlBuilder,
        CachedAccount,
        ['account', 'mirrorNetwork'],
      );

      const result = await dataSource.query(query, [
        '0.0.800',
        'mainnet',
        randomUUID(),
        new Date(Date.now() - 60000),
      ]);

      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].updatedAt).toBeInstanceOf(Date);
      expect(result[0].createdAt).toBeDefined();
      expect(result[0].updatedAt).toBeDefined();
    });

    it('should update updatedAt on successful claim', async () => {
      const oldDate = new Date(Date.now() - 120000);

      await dataSource.getRepository(CachedAccount).save({
        account: '0.0.900',
        mirrorNetwork: 'mainnet',
        refreshToken: null,
        createdAt: oldDate,
        updatedAt: oldDate,
      });

      const beforeClaim = new Date();

      const query = getUpsertRefreshTokenForCacheQuery(
        sqlBuilder,
        CachedAccount,
        ['account', 'mirrorNetwork'],
      );

      const result = await dataSource.query(query, [
        '0.0.900',
        'mainnet',
        randomUUID(),
        new Date(Date.now() - 60000),
      ]);

      // Allow tolerance for timing and timezone differences
      expect(result[0].updatedAt.getTime()).toBeGreaterThanOrEqual(beforeClaim.getTime());

      // createdAt should remain unchanged
      expect(result[0].createdAt.getTime()).toBe(oldDate.getTime());
    });
  });

  describe('concurrent claims', () => {
    it('should handle race condition where two clients try to claim same record', async () => {
      const winnerToken = randomUUID();

      await dataSource.getRepository(CachedAccount).save({
        account: '0.0.1000',
        mirrorNetwork: 'mainnet',
        refreshToken: null,
      });

      const query = getUpsertRefreshTokenForCacheQuery(
        sqlBuilder,
        CachedAccount,
        ['account', 'mirrorNetwork'],
      );

      const reclaimDate = new Date(Date.now() - 60000);

      // First claim should succeed
      const result1 = await dataSource.query(query, [
        '0.0.1000',
        'mainnet',
        winnerToken,
        reclaimDate,
      ]);

      expect(result1[0].refreshToken).toBe(winnerToken);

      // Second claim should return the winner's token
      const result2 = await dataSource.query(query, [
        '0.0.1000',
        'mainnet',
        randomUUID(),
        reclaimDate,
      ]);

      expect(result2[0].refreshToken).toBe(winnerToken);
    });
  });

  describe('parameter ordering', () => {
    it('should accept parameters in correct order: keys, refreshToken, reclaimDate', async () => {
      const token = randomUUID();
      const query = getUpsertRefreshTokenForCacheQuery(
        sqlBuilder,
        CachedAccount,
        ['account', 'mirrorNetwork'],
      );

      // Parameters: account, mirrorNetwork, refreshToken, reclaimDate
      const result = await dataSource.query(query, [
        '0.0.1100',         // key 1
        'mainnet',          // key 2
        token, // refreshToken
        new Date(Date.now() - 60000), // reclaimDate
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].account).toBe('0.0.1100');
      expect(result[0].mirrorNetwork).toBe('mainnet');
      expect(result[0].refreshToken).toBe(token);
    });
  });
});