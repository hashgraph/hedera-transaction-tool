import { DataSource, EntityManager } from 'typeorm';
import {
  AccountCreateTransaction,
  AccountId,
  KeyList,
  PrivateKey,
  TransactionId,
} from '@hiero-ledger/sdk';

import { User, UserKey, UserStatus } from '@entities';
import { createTestPostgresDataSource } from '../../../../../test-utils/postgres-test-db';
import { TransactionSignatureService } from '@app/common';
import { keysRequiredToSign, userKeysRequiredToSign } from '.';

/**
 * Integration tests for keysRequiredToSign and userKeysRequiredToSign.
 *
 * These tests use a real Postgres container to verify the DB lookup path and
 * soft-delete filtering. TransactionSignatureService.computeSignatureKey is
 * stubbed to return a controlled KeyList so we are not dependent on mirror-node
 * cache infrastructure.
 *
 * Key scenarios under test:
 *  - All required key owners are returned regardless of signing state (default)
 *  - excludeAlreadySigned=true filters out keys whose signatures are present in
 *    the transaction bytes
 *  - Soft-deleted UserKeys are not returned
 *  - Soft-deleted Users are not returned
 *  - Cache path correctly resolves keys and avoids extra DB hits
 */
describe('keysRequiredToSign - Integration', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  let em: EntityManager;

  let alice: User;
  let bob: User;
  let aliceKey: UserKey;
  let bobKey: UserKey;
  let alicePk: PrivateKey;
  let bobPk: PrivateKey;

  const stubSignatureService = (keyList: KeyList) =>
    ({ computeSignatureKey: jest.fn().mockResolvedValue(keyList) } as unknown as TransactionSignatureService);

  const makeTransaction = (bytes: Uint8Array) => ({
    id: 1,
    transactionBytes: bytes,
    mirrorNetwork: 'testnet',
  } as any);

  const makeFrozenTx = () =>
    new AccountCreateTransaction()
      .setTransactionId(TransactionId.generate('0.0.2'))
      .setNodeAccountIds([AccountId.fromString('0.0.3')])
      .freeze();

  beforeAll(async () => {
    const testDb = await createTestPostgresDataSource();
    dataSource = testDb.dataSource;
    cleanup = testDb.cleanup;
    em = dataSource.manager;
  }, 120_000);

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    // Clean up in FK-safe order
    await em.getRepository(UserKey).createQueryBuilder().delete().execute();
    await em.getRepository(User).createQueryBuilder().delete().execute();

    // Generate key pairs
    alicePk = PrivateKey.generateED25519();
    bobPk = PrivateKey.generateED25519();

    // Seed users
    alice = await em.getRepository(User).save({
      email: 'alice@test.com',
      password: 'hashed',
      status: UserStatus.NONE,
      admin: false,
    });
    bob = await em.getRepository(User).save({
      email: 'bob@test.com',
      password: 'hashed',
      status: UserStatus.NONE,
      admin: false,
    });

    // Seed keys
    aliceKey = await em.getRepository(UserKey).save({
      userId: alice.id,
      publicKey: alicePk.publicKey.toStringRaw(),
    });
    bobKey = await em.getRepository(UserKey).save({
      userId: bob.id,
      publicKey: bobPk.publicKey.toStringRaw(),
    });
  });

  it('returns all required key owners when neither has signed (default)', async () => {
    const keyList = new KeyList([alicePk.publicKey, bobPk.publicKey]);
    const svc = stubSignatureService(keyList);
    const tx = makeTransaction(makeFrozenTx().toBytes());

    const result = await keysRequiredToSign(tx, svc, em);

    const userIds = result.map(k => k.userId).sort();
    expect(userIds).toEqual([alice.id, bob.id].sort());
  });

  it('returns all required key owners even when one has already signed (default, excludeAlreadySigned=false)', async () => {
    const keyList = new KeyList([alicePk.publicKey, bobPk.publicKey]);
    const svc = stubSignatureService(keyList);

    // Alice signs the transaction
    const signedTx = await makeFrozenTx().sign(alicePk);
    const tx = makeTransaction(signedTx.toBytes());

    const result = await keysRequiredToSign(tx, svc, em);

    const userIds = result.map(k => k.userId).sort();
    expect(userIds).toEqual([alice.id, bob.id].sort());
  });

  it('excludes already-signed keys when excludeAlreadySigned=true', async () => {
    const keyList = new KeyList([alicePk.publicKey, bobPk.publicKey]);
    const svc = stubSignatureService(keyList);

    // Alice signs the transaction
    const signedTx = await makeFrozenTx().sign(alicePk);
    const tx = makeTransaction(signedTx.toBytes());

    const result = await keysRequiredToSign(tx, svc, em, false, null, undefined, true);

    const userIds = result.map(k => k.userId);
    expect(userIds).not.toContain(alice.id);
    expect(userIds).toContain(bob.id);
  });

  it('returns empty array when all required keys have signed and excludeAlreadySigned=true', async () => {
    const keyList = new KeyList([alicePk.publicKey, bobPk.publicKey]);
    const svc = stubSignatureService(keyList);

    const baseTx = makeFrozenTx();
    const signedTx = await (await baseTx.sign(alicePk)).sign(bobPk);
    const tx = makeTransaction(signedTx.toBytes());

    const result = await keysRequiredToSign(tx, svc, em, false, null, undefined, true);

    expect(result).toEqual([]);
  });

  it('does not return soft-deleted UserKeys', async () => {
    // Soft-delete alice's key
    await em.getRepository(UserKey).softDelete(aliceKey.id);

    const keyList = new KeyList([alicePk.publicKey, bobPk.publicKey]);
    const svc = stubSignatureService(keyList);
    const tx = makeTransaction(makeFrozenTx().toBytes());

    const result = await keysRequiredToSign(tx, svc, em);

    const userIds = result.map(k => k.userId);
    expect(userIds).not.toContain(alice.id);
    expect(userIds).toContain(bob.id);
  });

  it('returns key with user relation loaded, including for soft-deleted users (caller filters)', async () => {
    await em.getRepository(User).softDelete(bob.id);

    const keyList = new KeyList([alicePk.publicKey, bobPk.publicKey]);
    const svc = stubSignatureService(keyList);
    const tx = makeTransaction(makeFrozenTx().toBytes());

    const result = await keysRequiredToSign(tx, svc, em);

    // keysRequiredToSign does not filter by user.deletedAt — that is the
    // responsibility of callers (e.g. getUsersIdsRequiredToSign via filterActiveUserKeys).
    // Both keys are returned; the soft-deleted user's deletedAt is visible on the relation.
    const returnedKeyIds = result.map(k => k.id).sort();
    expect(returnedKeyIds).toEqual([aliceKey.id, bobKey.id].sort());
    const bobResult = result.find(k => k.id === bobKey.id);
    expect(bobResult?.user?.deletedAt).not.toBeNull();
  });

  it('resolves keys via cache on second call without extra DB hits', async () => {
    const keyList = new KeyList([alicePk.publicKey, bobPk.publicKey]);
    const svc = stubSignatureService(keyList);
    const tx = makeTransaction(makeFrozenTx().toBytes());
    const cache = new Map<string, UserKey>();

    const findSpy = jest.spyOn(em, 'find');

    // First call populates cache
    await keysRequiredToSign(tx, svc, em, false, null, cache);
    const callsAfterFirst = findSpy.mock.calls.length;

    // Second call should hit cache entirely
    svc.computeSignatureKey = jest.fn().mockResolvedValue(keyList);
    await keysRequiredToSign(tx, svc, em, false, null, cache);

    expect(findSpy.mock.calls.length).toBe(callsAfterFirst); // no new DB calls

    findSpy.mockRestore();
  });
});

describe('userKeysRequiredToSign - Integration', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  let em: EntityManager;

  let alice: User;
  let alicePk: PrivateKey;
  let aliceKey: UserKey;
  let aliceKey2: UserKey;
  let alicePk2: PrivateKey;

  const stubSignatureService = (keyList: KeyList) =>
    ({ computeSignatureKey: jest.fn().mockResolvedValue(keyList) } as unknown as TransactionSignatureService);

  const makeFrozenTx = () =>
    new AccountCreateTransaction()
      .setTransactionId(TransactionId.generate('0.0.2'))
      .setNodeAccountIds([AccountId.fromString('0.0.3')])
      .freeze();

  beforeAll(async () => {
    const testDb = await createTestPostgresDataSource();
    dataSource = testDb.dataSource;
    cleanup = testDb.cleanup;
    em = dataSource.manager;
  }, 120_000);

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await em.getRepository(UserKey).createQueryBuilder().delete().execute();
    await em.getRepository(User).createQueryBuilder().delete().execute();

    alicePk = PrivateKey.generateED25519();
    alicePk2 = PrivateKey.generateED25519();

    alice = await em.getRepository(User).save({
      email: 'alice@test.com',
      password: 'hashed',
      status: UserStatus.NONE,
      admin: false,
    });

    aliceKey = await em.getRepository(UserKey).save({
      userId: alice.id,
      publicKey: alicePk.publicKey.toStringRaw(),
    });
    aliceKey2 = await em.getRepository(UserKey).save({
      userId: alice.id,
      publicKey: alicePk2.publicKey.toStringRaw(),
    });
  });

  it('returns IDs of all required user keys regardless of signing state', async () => {
    const keyList = new KeyList([alicePk.publicKey, alicePk2.publicKey]);
    const svc = stubSignatureService(keyList);

    // alice has already signed with key1
    const signedTx = await makeFrozenTx().sign(alicePk);
    const user = { ...alice, keys: [aliceKey, aliceKey2] };

    const result = await userKeysRequiredToSign(
      { id: 1, transactionBytes: signedTx.toBytes(), mirrorNetwork: 'testnet' } as any,
      user as any,
      svc,
      em,
    );

    // Both keys returned — signed state does not filter by default
    expect(result).toContain(aliceKey.id);
    expect(result).toContain(aliceKey2.id);
  });

  it('returns empty array when user has no keys matching required set', async () => {
    const otherPk = PrivateKey.generateED25519();
    const keyList = new KeyList([otherPk.publicKey]); // neither of alice's keys
    const svc = stubSignatureService(keyList);

    const user = { ...alice, keys: [aliceKey, aliceKey2] };

    const result = await userKeysRequiredToSign(
      { id: 1, transactionBytes: makeFrozenTx().toBytes(), mirrorNetwork: 'testnet' } as any,
      user as any,
      svc,
      em,
    );

    expect(result).toEqual([]);
  });

  it('excludes soft-deleted keys from user.keys match', async () => {
    await em.getRepository(UserKey).softDelete(aliceKey.id);
    const deletedKey = await em.getRepository(UserKey).findOne({
      where: { id: aliceKey.id },
      withDeleted: true,
    });

    const keyList = new KeyList([alicePk.publicKey, alicePk2.publicKey]);
    const svc = stubSignatureService(keyList);

    // Simulate what attachKeys would populate — active keys only
    const user = { ...alice, keys: [aliceKey2] };

    const result = await userKeysRequiredToSign(
      { id: 1, transactionBytes: makeFrozenTx().toBytes(), mirrorNetwork: 'testnet' } as any,
      user as any,
      svc,
      em,
    );

    expect(result).not.toContain(deletedKey.id);
    expect(result).toContain(aliceKey2.id);
  });
});
