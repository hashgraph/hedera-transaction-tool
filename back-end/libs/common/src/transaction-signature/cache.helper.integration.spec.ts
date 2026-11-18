import { DataSource } from 'typeorm';
import { PrivateKey } from '@hiero-ledger/sdk';

import { CachedAccount, CachedAccountKey } from '@entities';
import { createTestPostgresDataSource } from '../../../../test-utils/postgres-test-db';
import { CacheHelper } from './cache.helper';

/**
 * Integration test for CacheHelper.replaceKeys against a real Postgres container.
 * Verifies that stale key rows are removed when the key set changes or becomes empty.
 */
describe('CacheHelper.replaceKeys - Integration', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  let helper: CacheHelper;
  let account: CachedAccount;

  const newPublicKey = () => PrivateKey.generateED25519().publicKey;

  const storedKeys = async (cachedAccountId: number) =>
    (await dataSource.getRepository(CachedAccountKey).find({ where: { cachedAccountId } }))
      .map(k => k.publicKey)
      .sort();

  beforeAll(async () => {
    ({ dataSource, cleanup } = await createTestPostgresDataSource());
    helper = new CacheHelper(dataSource);
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "cached_account" RESTART IDENTITY CASCADE');
    account = await dataSource
      .getRepository(CachedAccount)
      .save({ account: '0.0.1001', mirrorNetwork: 'testnet' });
  });

  it('inserts the keys when none exist', async () => {
    const [a, b] = [newPublicKey(), newPublicKey()];

    await helper.replaceKeys(CachedAccountKey, account.id, 'cachedAccount', [a, b]);

    expect(await storedKeys(account.id)).toEqual([a.toStringRaw(), b.toStringRaw()].sort());
  });

  it('removes keys that are no longer present and adds new ones', async () => {
    const [a, b, c] = [newPublicKey(), newPublicKey(), newPublicKey()];
    await helper.replaceKeys(CachedAccountKey, account.id, 'cachedAccount', [a, b]);

    await helper.replaceKeys(CachedAccountKey, account.id, 'cachedAccount', [b, c]);

    expect(await storedKeys(account.id)).toEqual([b.toStringRaw(), c.toStringRaw()].sort());
  });

  it('clears all keys when the new set is empty (keyless account)', async () => {
    await helper.replaceKeys(CachedAccountKey, account.id, 'cachedAccount', [newPublicKey()]);

    await helper.replaceKeys(CachedAccountKey, account.id, 'cachedAccount', []);

    expect(await storedKeys(account.id)).toEqual([]);
  });

  it('only touches the given account', async () => {
    const other = await dataSource
      .getRepository(CachedAccount)
      .save({ account: '0.0.1002', mirrorNetwork: 'testnet' });
    const otherKey = newPublicKey();
    await helper.replaceKeys(CachedAccountKey, other.id, 'cachedAccount', [otherKey]);

    await helper.replaceKeys(CachedAccountKey, account.id, 'cachedAccount', [newPublicKey()]);
    await helper.replaceKeys(CachedAccountKey, account.id, 'cachedAccount', []);

    expect(await storedKeys(other.id)).toEqual([otherKey.toStringRaw()]);
  });
});
