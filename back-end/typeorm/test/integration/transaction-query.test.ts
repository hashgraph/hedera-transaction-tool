import { DataSource } from 'typeorm';
import {
  CachedAccount,
  CachedAccountKey,
  Transaction,
  TransactionCachedAccount,
  TransactionGroup,
  TransactionGroupItem,
  TransactionSigner,
  TransactionStatus,
  TransactionType,
  User,
  UserKey,
  UserStatus,
} from '@entities';
import { createTestPostgresDataSource } from '../../../test-utils/postgres-test-db';
import { getTransactionNodesQuery, SqlBuilderService } from '@app/common';

/**
 * Integration tests for getTransactionNodesQuery with deterministic seed data.
 *
 * All data is seeded once in beforeAll and shared (read-only) across tests.
 * This validates the isReceiver filter, terminal status override, grouped
 * transactions, publicKeys branch, and onlyUnsigned behavior end-to-end.
 */
describe('getTransactionNodesQuery - isReceiver integration', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  let sqlBuilder: SqlBuilderService;

  // Users
  let alice: User;
  let bob: User;
  let carol: User;
  let dave: User;

  // Transactions
  let tx1: Transaction;
  let tx2: Transaction;
  let tx3: Transaction;
  let tx4: Transaction;
  let tx5: Transaction;
  let tx6: Transaction;
  let tx7: Transaction;
  let tx8: Transaction;
  let tx9: Transaction;

  // Group
  let group1: TransactionGroup;

  beforeAll(async () => {
    const testDb = await createTestPostgresDataSource();
    dataSource = testDb.dataSource;
    cleanup = testDb.cleanup;
    sqlBuilder = new SqlBuilderService(dataSource.manager);

    // --- Create Users & Keys ---
    alice = await createUser(dataSource, 'alice@test.com', 'pk-alice');
    bob = await createUser(dataSource, 'bob@test.com', 'pk-bob');
    carol = await createUser(dataSource, 'carol@test.com', 'pk-carol');
    dave = await createUser(dataSource, 'dave@test.com', 'pk-dave');

    // --- tx1: Bob is signer (non-receiver), created by alice ---
    tx1 = await createTx(dataSource, alice, TransactionStatus.WAITING_FOR_SIGNATURES, 'tx1');
    await linkAccount(dataSource, tx1, bob, false, false);

    // --- tx2: Carol is receiver only, created by alice ---
    tx2 = await createTx(dataSource, alice, TransactionStatus.WAITING_FOR_SIGNATURES, 'tx2');
    await linkAccount(dataSource, tx2, carol, false, true);

    // --- tx3: Carol is receiver only, EXECUTED (terminal status) ---
    tx3 = await createTx(dataSource, alice, TransactionStatus.EXECUTED, 'tx3');
    await linkAccount(dataSource, tx3, carol, false, true);

    // --- tx4: Dave is both signer + receiver via 2 different accounts ---
    tx4 = await createTx(dataSource, alice, TransactionStatus.WAITING_FOR_SIGNATURES, 'tx4');
    await linkAccount(dataSource, tx4, dave, false, false); // signer account
    await linkAccount(dataSource, tx4, dave, false, true);  // receiver account

    // --- tx5: Bob is signer, already signed ---
    tx5 = await createTx(dataSource, alice, TransactionStatus.WAITING_FOR_SIGNATURES, 'tx5');
    await linkAccount(dataSource, tx5, bob, false, false);
    await createSigner(dataSource, tx5, bob.keys[0]);

    // --- tx6: Bob has publicKey match on transaction, cached acct is receiver ---
    tx6 = await createTx(dataSource, alice, TransactionStatus.WAITING_FOR_SIGNATURES, 'tx6');
    await linkAccount(dataSource, tx6, bob, false, true); // receiver-only cached account
    await dataSource.getRepository(Transaction).update(
      { id: tx6.id },
      { publicKeys: ['pk-bob'] },
    );

    // --- tx2: Carol is required receiver only, created by alice ---
    tx7 = await createTx(dataSource, alice, TransactionStatus.WAITING_FOR_SIGNATURES, 'tx7');
    await linkAccount(dataSource, tx7, carol, true, true);

    // --- tx8 & tx9: Grouped transactions ---
    group1 = await createGroup(dataSource);

    tx8 = await createTx(dataSource, alice, TransactionStatus.WAITING_FOR_SIGNATURES, 'tx7');
    await linkAccount(dataSource, tx8, bob, false, false); // non-receiver signer
    await createGroupItem(dataSource, group1, tx8, 0);

    tx9 = await createTx(dataSource, alice, TransactionStatus.WAITING_FOR_SIGNATURES, 'tx8');
    await linkAccount(dataSource, tx9, bob, false, true); // receiver only
    await createGroupItem(dataSource, group1, tx9, 1);
  }, 120_000);

  afterAll(async () => {
    await cleanup();
  });

  const waitingFilter = { statuses: [TransactionStatus.WAITING_FOR_SIGNATURES] };
  const executedFilter = { statuses: [TransactionStatus.EXECUTED] };
  const signerRole = { signer: true };

  // --- Scenario 1, 7, 8: Bob as signer, WAITING_FOR_SIGNATURES ---
  describe('bob as signer (WAITING_FOR_SIGNATURES)', () => {
    let result: any[];

    beforeAll(async () => {
      const query = getTransactionNodesQuery(sqlBuilder, waitingFilter, bob, signerRole);
      result = await dataSource.query(query.text, query.values);
    });

    it('should return tx1, tx5, tx6, and one group row', () => {
      // tx1: bob is non-receiver signer
      // tx5: bob is non-receiver signer (already signed, but onlyUnsigned not set)
      // tx6: bob matches via publicKeys branch
      // group(tx8+tx9): bob is non-receiver on tx8
      // NOT tx2 (carol), tx3 (carol, executed), tx4 (dave)
      const txIds = result.filter(r => r.transaction_id !== null).map(r => r.transaction_id);
      const groupIds = result.filter(r => r.group_id !== null).map(r => r.group_id);

      expect(txIds).toHaveLength(3);
      expect(txIds).toContain(tx1.id);
      expect(txIds).toContain(tx5.id);
      expect(txIds).toContain(tx6.id);
      expect(groupIds).toHaveLength(1);
      expect(groupIds[0]).toBe(group1.id);
    });

    it('(scenario 7) group row should have group_collected_count = 1 (only tx8, not tx9)', () => {
      const groupRow = result.find(r => r.group_id === group1.id);
      expect(Number(groupRow.group_collected_count)).toBe(1);
    });

    it('(scenario 8) tx6 is returned via publicKeys path bypassing receiver filter', () => {
      const tx6Row = result.find(r => r.transaction_id === tx6.id);
      expect(tx6Row).toBeDefined();
    });
  });

  // --- Scenario 2: Carol as signer, WAITING_FOR_SIGNATURES ---
  it('should return 1 result for carol as signer (receiver-only)', async () => {
    const query = getTransactionNodesQuery(sqlBuilder, waitingFilter, carol, signerRole);
    const result = await dataSource.query(query.text, query.values);

    const txIds = result.filter(r => r.transaction_id !== null).map(r => r.transaction_id);

    expect(txIds).toHaveLength(1);
    expect(txIds).toContain(tx7.id);
  });

  // --- Scenario 3: Carol as signer, EXECUTED (terminal status override) ---
  it('should return tx3 for carol with EXECUTED status (terminal override)', async () => {
    const query = getTransactionNodesQuery(sqlBuilder, executedFilter, carol, signerRole);
    const result = await dataSource.query(query.text, query.values);
    expect(result).toHaveLength(1);
    expect(result[0].transaction_id).toBe(tx3.id);
  });

  // --- Scenario 4: Dave as signer, WAITING_FOR_SIGNATURES ---
  it('should return tx4 for dave (has non-receiver link despite also having receiver link)', async () => {
    const query = getTransactionNodesQuery(sqlBuilder, waitingFilter, dave, signerRole);
    const result = await dataSource.query(query.text, query.values);
    expect(result).toHaveLength(1);
    expect(result[0].transaction_id).toBe(tx4.id);
  });

  // --- Scenario 5: Alice as creator, WAITING_FOR_SIGNATURES ---
  it('should return all WAITING txs for alice as creator', async () => {
    const query = getTransactionNodesQuery(sqlBuilder, waitingFilter, alice, { creator: true });
    const result = await dataSource.query(query.text, query.values);

    // alice created tx1, tx2, tx4, tx5, tx6, and grouped tx8+tx9 (1 group row)
    // tx3 is EXECUTED so excluded by status filter
    const txIds = result.filter(r => r.transaction_id !== null).map(r => r.transaction_id);
    const groupIds = result.filter(r => r.group_id !== null).map(r => r.group_id);

    expect(txIds).toHaveLength(6);
    expect(txIds).toContain(tx1.id);
    expect(txIds).toContain(tx2.id);
    expect(txIds).toContain(tx4.id);
    expect(txIds).toContain(tx5.id);
    expect(txIds).toContain(tx6.id);
    expect(txIds).toContain(tx7.id);
    expect(groupIds).toHaveLength(1);
    expect(groupIds[0]).toBe(group1.id);
  });

  // --- Scenario 6: Bob as signer, onlyUnsigned ---
  it('should exclude tx5 for bob when onlyUnsigned is true', async () => {
    const query = getTransactionNodesQuery(sqlBuilder, waitingFilter, bob, {
      signer: true,
      onlyUnsigned: true,
    });
    const result = await dataSource.query(query.text, query.values);

    const txIds = result.filter(r => r.transaction_id !== null).map(r => r.transaction_id);
    const groupIds = result.filter(r => r.group_id !== null).map(r => r.group_id);

    // tx1: unsigned non-receiver signer
    // tx6: unsigned via publicKeys
    // group(tx8): unsigned non-receiver signer
    // NOT tx5 (already signed)
    expect(txIds).toHaveLength(2);
    expect(txIds).toContain(tx1.id);
    expect(txIds).toContain(tx6.id);
    expect(txIds).not.toContain(tx5.id);
    expect(groupIds).toHaveLength(1);
    expect(groupIds[0]).toBe(group1.id);
  });
});

// --- Helper Functions ---

async function createUser(
  ds: DataSource,
  email: string,
  publicKey: string,
): Promise<User> {
  const user = ds.getRepository(User).create({
    email,
    password: 'password',
    admin: false,
    status: UserStatus.NONE,
    keys: [],
    signerForTransactions: [],
    observableTransactions: [],
    approvableTransactions: [],
    comments: [],
    issuedNotifications: [],
    receivedNotifications: [],
    notificationPreferences: [],
    clients: [],
  });
  await ds.getRepository(User).save(user);

  const key = ds.getRepository(UserKey).create({
    userId: user.id,
    publicKey,
    mnemonicHash: null,
    index: null,
    createdTransactions: [],
    approvedTransactions: [],
    signedTransactions: [],
  });
  await ds.getRepository(UserKey).save(key);

  user.keys = [key];
  return user;
}

let txCounter = 0;

async function createTx(
  ds: DataSource,
  creator: User,
  status: TransactionStatus,
  label: string,
): Promise<Transaction> {
  txCounter++;
  const seconds = 1700000000 + txCounter;
  const transactionId = `0.0.100@${seconds}.0`;

  const tx = ds.getRepository(Transaction).create({
    name: label,
    type: TransactionType.TRANSFER,
    description: label,
    transactionId,
    transactionHash: Buffer.from(`hash-${label}`).toString('hex'),
    transactionBytes: Buffer.from('tx-bytes'),
    unsignedTransactionBytes: Buffer.from('unsigned-tx-bytes'),
    status,
    statusCode: null,
    creatorKeyId: creator.keys[0].id,
    signature: Buffer.from('signature'),
    validStart: new Date(seconds * 1000),
    mirrorNetwork: 'mainnet',
    isManual: false,
    cutoffAt: null,
    createdAt: new Date(seconds * 1000),
    executedAt: null,
    updatedAt: new Date(seconds * 1000),
    deletedAt: null,
    comments: [],
    signers: [],
    approvers: [],
    observers: [],
    groupItem: null,
    transactionCachedAccounts: [],
    transactionCachedNodes: [],
  });
  await ds.getRepository(Transaction).save(tx);
  return tx;
}

let accountCounter = 0;

async function linkAccount(
  ds: DataSource,
  tx: Transaction,
  user: User,
  receiverSignatureRequired: boolean,
  isReceiver: boolean,
): Promise<void> {
  accountCounter++;

  const cachedAccount = ds.getRepository(CachedAccount).create({
    account: `0.0.${9000 + accountCounter}`,
    mirrorNetwork: 'mainnet',
    receiverSignatureRequired,
    encodedKey: null,
    etag: null,
    keys: [],
    accountTransactions: [],
  });
  await ds.getRepository(CachedAccount).save(cachedAccount);

  const cachedAccountKey = ds.getRepository(CachedAccountKey).create({
    cachedAccountId: cachedAccount.id,
    publicKey: user.keys[0].publicKey,
  });
  await ds.getRepository(CachedAccountKey).save(cachedAccountKey);

  const txCachedAccount = ds.getRepository(TransactionCachedAccount).create({
    transactionId: tx.id,
    cachedAccountId: cachedAccount.id,
    isReceiver,
  });
  await ds.getRepository(TransactionCachedAccount).save(txCachedAccount);
}

async function createSigner(
  ds: DataSource,
  tx: Transaction,
  userKey: UserKey,
): Promise<void> {
  const signer = ds.getRepository(TransactionSigner).create({
    transactionId: tx.id,
    userKeyId: userKey.id,
    userId: userKey.userId,
  });
  await ds.getRepository(TransactionSigner).save(signer);
}

async function createGroup(ds: DataSource): Promise<TransactionGroup> {
  const group = ds.getRepository(TransactionGroup).create({
    description: 'Test Group',
    atomic: false,
    sequential: false,
    groupItems: [],
  });
  await ds.getRepository(TransactionGroup).save(group);
  return group;
}

async function createGroupItem(
  ds: DataSource,
  group: TransactionGroup,
  tx: Transaction,
  seq: number,
): Promise<void> {
  const item = ds.getRepository(TransactionGroupItem).create({
    seq,
    groupId: group.id,
    transactionId: tx.id,
  });
  await ds.getRepository(TransactionGroupItem).save(item);
}
