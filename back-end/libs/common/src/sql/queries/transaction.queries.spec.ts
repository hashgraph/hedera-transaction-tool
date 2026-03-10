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
import { createTestPostgresDataSource } from '../../../../../test-utils/postgres-test-db';
import { getTransactionNodesQuery, SqlBuilderService } from '@app/common';

describe('getTransactionNodesForUser - Integration', () => {
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
    const entities = [
      TransactionSigner,
      TransactionCachedAccount,
      TransactionGroupItem,
      CachedAccountKey,
      CachedAccount,
      Transaction,
      TransactionGroup,
      UserKey,
      User,
    ];

    for (const entity of entities) {
      await dataSource.getRepository(entity).delete({});
    }
  });

  const defaultFilters = {
    statuses: [TransactionStatus.WAITING_FOR_SIGNATURES],
  };

  const signerRoles = { signer: true } as const;

  describe('query execution', () => {
    it('should execute without errors on empty database', async () => {
      const user = await createTestUserWithKeys(dataSource);

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, user, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toEqual([]);
    });

    it('should return ungrouped transaction that needs signing', async () => {
      const user = await createTestUserWithKeys(dataSource);
      const transaction = await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, user, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBe(transaction.id);
      expect(result[0].group_id).toBeNull();
      expect(result[0].status).toBe(TransactionStatus.WAITING_FOR_SIGNATURES);
    });

    it('should not return transaction already signed by user when onlyUnsigned is true', async () => {
      const user = await createTestUserWithKeys(dataSource);
      const transaction = await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await createTransactionSigner(dataSource, transaction, user.keys[0]);

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, user, {
        ...signerRoles,
        onlyUnsigned: true,
      });
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(0);
    });

    it('should return transaction if only partially signed', async () => {
      const user = await createTestUserWithKeys(dataSource, 2);
      const transaction = await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        requireBothKeys: true,
      });

      // Only signed with first key
      await createTransactionSigner(dataSource, transaction, user.keys[0]);

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, user, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBe(transaction.id);
    });

    it('should filter by status', async () => {
      const user = await createTestUserWithKeys(dataSource);

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.EXECUTED,
      });

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, user, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(TransactionStatus.WAITING_FOR_SIGNATURES);
    });

    it('should filter by mirror network', async () => {
      const user = await createTestUserWithKeys(dataSource);

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        mirrorNetwork: 'mainnet',
      });

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        mirrorNetwork: 'testnet',
      });

      const filters = {
        ...defaultFilters,
        mirrorNetwork: 'mainnet',
      };

      const query = getTransactionNodesQuery(sqlBuilder, filters, user, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBeDefined();
    });
  });

  describe('onlyUnsigned role flag', () => {
    it('should show transaction to non-creator signer when they have not signed yet (onlyUnsigned: true)', async () => {
      const creator = await createTestUserWithKeys(dataSource);
      const signer = await createTestUserWithKeys(dataSource);

      const transaction = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await linkSignerToTransaction(dataSource, transaction, signer);

      // Signer has NOT signed yet
      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, signer, {
        signer: true,
        onlyUnsigned: true,
      });
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBe(transaction.id);
    });

    it('should NOT show transaction to non-creator signer when they have already signed (onlyUnsigned: true)', async () => {
      const creator = await createTestUserWithKeys(dataSource);
      const signer = await createTestUserWithKeys(dataSource);

      const transaction = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await linkSignerToTransaction(dataSource, transaction, signer);

      // Signer HAS signed
      await createTransactionSigner(dataSource, transaction, signer.keys[0]);

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, signer, {
        signer: true,
        onlyUnsigned: true,
      });
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(0);
    });

    it('should show transaction to non-creator signer even when they have signed (onlyUnsigned: false)', async () => {
      const creator = await createTestUserWithKeys(dataSource);
      const signer = await createTestUserWithKeys(dataSource);

      const transaction = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await linkSignerToTransaction(dataSource, transaction, signer);

      // Signer HAS signed
      await createTransactionSigner(dataSource, transaction, signer.keys[0]);

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, signer, {
        signer: true,
        onlyUnsigned: false,
      });
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBe(transaction.id);
    });

    it('should show transaction via publicKeys when user has not signed (onlyUnsigned: true)', async () => {
      const creator = await createTestUserWithKeys(dataSource);
      const signer = await createTestUserWithKeys(dataSource);

      const transaction = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await dataSource.getRepository(Transaction).update(
        { id: transaction.id },
        { publicKeys: [signer.keys[0].publicKey] },
      );

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, signer, {
        signer: true,
        onlyUnsigned: true,
      });
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBe(transaction.id);
    });

    it('should NOT show transaction via publicKeys when user has signed (onlyUnsigned: true)', async () => {
      const creator = await createTestUserWithKeys(dataSource);
      const signer = await createTestUserWithKeys(dataSource);

      const transaction = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await dataSource.getRepository(Transaction).update(
        { id: transaction.id },
        { publicKeys: [signer.keys[0].publicKey] },
      );

      await createTransactionSigner(dataSource, transaction, signer.keys[0]);

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, signer, {
        signer: true,
        onlyUnsigned: true,
      });
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(0);
    });

    it('should show transaction via publicKeys when user has signed (onlyUnsigned: false)', async () => {
      const creator = await createTestUserWithKeys(dataSource);
      const signer = await createTestUserWithKeys(dataSource);

      const transaction = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await dataSource.getRepository(Transaction).update(
        { id: transaction.id },
        { publicKeys: [signer.keys[0].publicKey] },
      );

      await createTransactionSigner(dataSource, transaction, signer.keys[0]);

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, signer, {
        signer: true,
        onlyUnsigned: false,
      });
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBe(transaction.id);
    });
  });

  describe('grouped transactions', () => {
    it('should return one row per group', async () => {
      const user = await createTestUserWithKeys(dataSource);
      const group = await createTestTransactionGroup(dataSource);

      for (let i = 0; i < 3; i++) {
        await createTestTransaction(dataSource, user, {
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          groupId: group.id,
          seq: i,
        });
      }

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, user, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].group_id).toBe(group.id);
      expect(result[0].transaction_id).toBeNull();
    });

    it('should calculate group_item_count correctly', async () => {
      const user = await createTestUserWithKeys(dataSource);
      const group = await createTestTransactionGroup(dataSource);

      for (let i = 0; i < 5; i++) {
        await createTestTransaction(dataSource, user, {
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          groupId: group.id,
          seq: i,
        });
      }

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, user, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result[0].group_item_count).toBe(5);
    });

    it('should calculate group_collected_count correctly (only eligible transactions)', async () => {
      const user = await createTestUserWithKeys(dataSource);
      const group = await createTestTransactionGroup(dataSource);

      // 5 tx total; user has already signed 2, so 3 remain eligible
      for (let i = 0; i < 5; i++) {
        const tx = await createTestTransaction(dataSource, user, {
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          groupId: group.id,
          seq: i,
        });

        if (i < 2) {
          await createTransactionSigner(dataSource, tx, user.keys[0]);
        }
      }

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, user, {
        ...signerRoles,
        onlyUnsigned: true,
      });
      const result = await dataSource.query(query.text, query.values);

      expect(result[0].group_item_count).toBe(5);
      expect(result[0].group_collected_count).toBe(3);
    });

    it('should return uniform status when all transactions have same status', async () => {
      const user = await createTestUserWithKeys(dataSource);
      const group = await createTestTransactionGroup(dataSource);

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        groupId: group.id,
        seq: 0,
      });
      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        groupId: group.id,
        seq: 1,
      });

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, user, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result[0].status).toBe(TransactionStatus.WAITING_FOR_SIGNATURES);
    });

    it('should return null status when transactions have mixed statuses', async () => {
      const user = await createTestUserWithKeys(dataSource);
      const group = await createTestTransactionGroup(dataSource);

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        groupId: group.id,
        seq: 0,
      });
      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        groupId: group.id,
        seq: 1,
      });

      const filters = {
        statuses: [
          TransactionStatus.WAITING_FOR_SIGNATURES,
          TransactionStatus.WAITING_FOR_EXECUTION,
        ],
      };

      const query = getTransactionNodesQuery(sqlBuilder, filters, user, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result[0].status).toBeNull();
    });

    it('should use group description when available', async () => {
      const user = await createTestUserWithKeys(dataSource);
      const group = await createTestTransactionGroup(dataSource, {
        description: 'Group Description',
      });

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        description: 'Transaction Description',
        groupId: group.id,
        seq: 0,
      });

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, user, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result[0].description).toBe('Group Description');
    });
  });

  describe('ordering', () => {
    it('should order by created_at DESC', async () => {
      const user = await createTestUserWithKeys(dataSource);

      const tx1 = await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        createdAt: new Date('2024-01-01'),
      });

      const tx2 = await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        createdAt: new Date('2024-01-03'),
      });

      const tx3 = await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        createdAt: new Date('2024-01-02'),
      });

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, user, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(3);
      expect(result[0].transaction_id).toBe(tx2.id);
      expect(result[1].transaction_id).toBe(tx3.id);
      expect(result[2].transaction_id).toBe(tx1.id);
    });
  });

  describe('receiver account filtering', () => {
    it('should NOT show transaction when user key only matches a receiver account', async () => {
      const creator = await createTestUserWithKeys(dataSource);
      const signer = await createTestUserWithKeys(dataSource);

      const transaction = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await linkSignerToTransaction(dataSource, transaction, signer, { isReceiver: true });

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, signer, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(0);
    });

    it('should show transaction when user key matches a non-receiver account', async () => {
      const creator = await createTestUserWithKeys(dataSource);
      const signer = await createTestUserWithKeys(dataSource);

      const transaction = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await linkSignerToTransaction(dataSource, transaction, signer, { isReceiver: false });

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, signer, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBe(transaction.id);
    });

    it('should show transaction when user has keys on both receiver AND non-receiver accounts', async () => {
      const creator = await createTestUserWithKeys(dataSource);
      const signer = await createTestUserWithKeys(dataSource);

      const transaction = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await linkSignerToTransaction(dataSource, transaction, signer, { isReceiver: true });
      await linkSignerToTransaction(dataSource, transaction, signer, { isReceiver: false });

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, signer, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBe(transaction.id);
    });

    it('should NOT show receiver-only transaction even with onlyUnsigned: false', async () => {
      const creator = await createTestUserWithKeys(dataSource);
      const signer = await createTestUserWithKeys(dataSource);

      const transaction = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await linkSignerToTransaction(dataSource, transaction, signer, { isReceiver: true });

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, signer, {
        signer: true,
        onlyUnsigned: false,
      });
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(0);
    });

    it('should show receiver-linked transaction if user is also creator', async () => {
      const user = await createTestUserWithKeys(dataSource);

      const transaction = await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        isReceiver: true,
      });

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, user, {
        signer: true,
        creator: true,
      });
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBe(transaction.id);
    });

    it('should show receiver-only transaction with terminal status override', async () => {
      const creator = await createTestUserWithKeys(dataSource);
      const signer = await createTestUserWithKeys(dataSource);

      const transaction = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.EXECUTED,
      });

      await linkSignerToTransaction(dataSource, transaction, signer, { isReceiver: true });

      const query = getTransactionNodesQuery(
        sqlBuilder,
        { statuses: [TransactionStatus.EXECUTED] },
        signer,
        signerRoles,
      );
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBe(transaction.id);
    });

    it('should show transaction via publicKeys even when cached account is receiver-only', async () => {
      const creator = await createTestUserWithKeys(dataSource);
      const signer = await createTestUserWithKeys(dataSource);

      const transaction = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await linkSignerToTransaction(dataSource, transaction, signer, { isReceiver: true });

      await dataSource.getRepository(Transaction).update(
        { id: transaction.id },
        { publicKeys: [signer.keys[0].publicKey] },
      );

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, signer, signerRoles);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBe(transaction.id);
    });

    it('should handle grouped transaction with mixed receiver/non-receiver links', async () => {
      const creator = await createTestUserWithKeys(dataSource);
      const signer = await createTestUserWithKeys(dataSource);
      const group = await createTestTransactionGroup(dataSource);

      const txA = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        groupId: group.id,
        seq: 0,
      });
      await linkSignerToTransaction(dataSource, txA, signer, { isReceiver: false });

      const txB = await createTestTransaction(dataSource, creator, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        groupId: group.id,
        seq: 1,
      });
      await linkSignerToTransaction(dataSource, txB, signer, { isReceiver: true });

      const query = getTransactionNodesQuery(sqlBuilder, defaultFilters, signer, {
        ...signerRoles,
        onlyUnsigned: true,
      });
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].group_id).toBe(group.id);
      expect(Number(result[0].group_collected_count)).toBe(1);
    });
  });
});

// --- Helpers ---

async function createTestUserWithKeys(
  dataSource: DataSource,
  keyCount: number = 1,
): Promise<User> {
  const user = dataSource.getRepository(User).create({
    email: `test-user-${Date.now()}-${Math.random()}@example.com`,
    password: 'test-password',
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
  await dataSource.getRepository(User).save(user);

  const keys: UserKey[] = [];
  for (let i = 0; i < keyCount; i++) {
    const userKey = dataSource.getRepository(UserKey).create({
      userId: user.id,
      publicKey: 'test-public-key-' + Math.random().toString(36).slice(2),
      mnemonicHash: null,
      index: null,
      createdTransactions: [],
      approvedTransactions: [],
      signedTransactions: [],
    });
    await dataSource.getRepository(UserKey).save(userKey);
    keys.push(userKey);
  }

  user.keys = keys;
  return user;
}

async function createTestTransaction(
  dataSource: DataSource,
  user: User,
  options: {
    status: TransactionStatus;
    mirrorNetwork?: string;
    description?: string;
    groupId?: number;
    seq?: number;
    createdAt?: Date;
    requireBothKeys?: boolean;
    isReceiver?: boolean;
  },
): Promise<Transaction> {
  const now = options.createdAt || new Date();
  const millis = now.getTime();
  const seconds = Math.floor(millis / 1000);
  const nanos = (millis % 1000) * 1_000_000;

  const accountId = '0.0.100';
  const transactionId = `${accountId}@${seconds}.${nanos}`;

  const transaction = dataSource.getRepository(Transaction).create({
    name: 'Test Transaction',
    type: TransactionType.TRANSFER,
    description: options.description || 'Test Transaction',
    transactionId,
    transactionHash: Buffer.from('hash-' + Math.random().toString(36).slice(2)).toString('hex'),
    transactionBytes: Buffer.from('tx-bytes'),
    unsignedTransactionBytes: Buffer.from('unsigned-tx-bytes'),
    status: options.status,
    statusCode: null,
    creatorKeyId: user.keys[0].id,
    signature: Buffer.from('signature'),
    validStart: options.createdAt || new Date(),
    mirrorNetwork: options.mirrorNetwork || 'mainnet',
    isManual: false,
    cutoffAt: null,
    createdAt: options.createdAt || new Date(),
    executedAt: null,
    updatedAt: options.createdAt || new Date(),
    deletedAt: null,
    comments: [],
    signers: [],
    approvers: [],
    observers: [],
    groupItem: null,
    transactionCachedAccounts: [],
    transactionCachedNodes: [],
  });
  await dataSource.getRepository(Transaction).save(transaction);

  const cachedAccount = dataSource.getRepository(CachedAccount).create({
    account: `0.0.${transaction.id}`,
    mirrorNetwork: options.mirrorNetwork || 'mainnet',
    receiverSignatureRequired: null,
    encodedKey: null,
    etag: null,
    keys: [],
    accountTransactions: [],
  });
  await dataSource.getRepository(CachedAccount).save(cachedAccount);

  const cachedAccountKey = dataSource.getRepository(CachedAccountKey).create({
    cachedAccountId: cachedAccount.id,
    publicKey: user.keys[0].publicKey,
  });
  await dataSource.getRepository(CachedAccountKey).save(cachedAccountKey);

  if (options.requireBothKeys && user.keys[1]) {
    const cachedAccountKey2 = dataSource.getRepository(CachedAccountKey).create({
      cachedAccountId: cachedAccount.id,
      publicKey: user.keys[1].publicKey,
    });
    await dataSource.getRepository(CachedAccountKey).save(cachedAccountKey2);
  }

  const transactionCachedAccount = dataSource.getRepository(TransactionCachedAccount).create({
    transactionId: transaction.id,
    cachedAccountId: cachedAccount.id,
    isReceiver: options.isReceiver ?? false,
  });
  await dataSource.getRepository(TransactionCachedAccount).save(transactionCachedAccount);

  if (options.groupId !== undefined) {
    const groupItem = dataSource.getRepository(TransactionGroupItem).create({
      seq: options.seq,
      groupId: options.groupId,
      transactionId: transaction.id,
    });
    await dataSource.getRepository(TransactionGroupItem).save(groupItem);
  }

  return transaction;
}

async function createTestTransactionGroup(
  dataSource: DataSource,
  options?: { description?: string },
): Promise<TransactionGroup> {
  const group = dataSource.getRepository(TransactionGroup).create({
    description: options?.description || 'Test Group',
    atomic: false,
    sequential: false,
    groupItems: [],
  });
  await dataSource.getRepository(TransactionGroup).save(group);
  return group;
}

async function createTransactionSigner(
  dataSource: DataSource,
  transaction: Transaction,
  userKey: UserKey,
): Promise<TransactionSigner> {
  const signer = dataSource.getRepository(TransactionSigner).create({
    transactionId: transaction.id,
    userKeyId: userKey.id,
    userId: userKey.userId,
  });
  await dataSource.getRepository(TransactionSigner).save(signer);
  return signer;
}

/**
 * Links a signer's key to a transaction via a cached account,
 * replicating how the app associates signers with transactions.
 */
async function linkSignerToTransaction(
  dataSource: DataSource,
  transaction: Transaction,
  signer: User,
  options?: { isReceiver?: boolean },
): Promise<void> {
  const cachedAccount = dataSource.getRepository(CachedAccount).create({
    account: `0.0.${transaction.id + 1000}-${Math.random().toString(36).slice(2)}`,
    mirrorNetwork: 'mainnet',
    receiverSignatureRequired: null,
    encodedKey: null,
    etag: null,
    keys: [],
    accountTransactions: [],
  });
  await dataSource.getRepository(CachedAccount).save(cachedAccount);

  const cachedAccountKey = dataSource.getRepository(CachedAccountKey).create({
    cachedAccountId: cachedAccount.id,
    publicKey: signer.keys[0].publicKey,
  });
  await dataSource.getRepository(CachedAccountKey).save(cachedAccountKey);

  const transactionCachedAccount = dataSource.getRepository(TransactionCachedAccount).create({
    transactionId: transaction.id,
    cachedAccountId: cachedAccount.id,
    isReceiver: options?.isReceiver ?? false,
  });
  await dataSource.getRepository(TransactionCachedAccount).save(transactionCachedAccount);
}