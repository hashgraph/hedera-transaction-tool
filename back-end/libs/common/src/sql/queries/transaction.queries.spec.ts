import { DataSource } from 'typeorm';
import { SqlBuilderService } from '../sql-builder.service';
import {
  CachedAccount,
  CachedAccountKey,
  Transaction,
  TransactionCachedAccount,
  TransactionGroup,
  TransactionGroupItem,
  TransactionSigner,
  TransactionStatus,
  User,
  UserKey,
} from '@entities';
import { createTestPostgresDataSource } from '../../../../../test-utils/postgres-test-db';
import { selectTransactionNodesToSignForUser } from '@app/common';

describe('selectTransactionNodesToSignForUser - Integration', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  let sqlBuilder: SqlBuilderService;

  beforeAll(async () => {
    const testDb = await createTestPostgresDataSource();
    dataSource = testDb.dataSource;
    cleanup = testDb.cleanup;
    sqlBuilder = new SqlBuilderService(dataSource.manager);
  }, 60000); // Increased timeout for container startup

  afterAll(async () => {
    await cleanup();
  });

  afterEach(async () => {
    // Clean up test data after each test
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

  describe('query execution', () => {
    it('should execute without errors on empty database', async () => {
      const user = await createTestUser(dataSource);

      const query = selectTransactionNodesToSignForUser(sqlBuilder, user);

      const result = await dataSource.query(query.text, query.values);

      expect(result).toEqual([]);
    });

    it('should return ungrouped transaction that needs signing', async () => {
      const user = await createTestUser(dataSource);
      const transaction = await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      const query = selectTransactionNodesToSignForUser(sqlBuilder, user);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBe(transaction.id);
      expect(result[0].group_id).toBeNull();
      expect(result[0].status).toBe(TransactionStatus.WAITING_FOR_SIGNATURES);
    });

    it('should not return transaction already signed by user', async () => {
      const user = await createTestUser(dataSource);
      const transaction = await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      // User has already signed
      await createTransactionSigner(dataSource, transaction, user.keys[0]);

      const query = selectTransactionNodesToSignForUser(sqlBuilder, user);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(0);
    });

    it('should return transaction if only partially signed', async () => {
      const user = await createTestUserWithMultipleKeys(dataSource, 2);
      const transaction = await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        requireBothKeys: true,
      });

      // Only signed with first key
      await createTransactionSigner(dataSource, transaction, user.keys[0]);

      const query = selectTransactionNodesToSignForUser(sqlBuilder, user);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBe(transaction.id);
    });

    it('should filter by status', async () => {
      const user = await createTestUser(dataSource);

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      });

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.EXECUTED,
      });

      const query = selectTransactionNodesToSignForUser(sqlBuilder, user);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(TransactionStatus.WAITING_FOR_SIGNATURES);
    });

    it('should filter by mirror network', async () => {
      const user = await createTestUser(dataSource);

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        mirrorNetwork: 'mainnet',
      });

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        mirrorNetwork: 'testnet',
      });

      const query = selectTransactionNodesToSignForUser(
        sqlBuilder,
        user,
        'mainnet'
      );
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].transaction_id).toBeDefined();
    });
  });

  describe('grouped transactions', () => {
    it('should return one row per group', async () => {
      const user = await createTestUser(dataSource);
      const group = await createTestTransactionGroup(dataSource);

      // Create 3 transactions in the group
      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        groupId: group.id,
      });
      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        groupId: group.id,
      });
      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        groupId: group.id,
      });

      const query = selectTransactionNodesToSignForUser(sqlBuilder, user);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(1);
      expect(result[0].group_id).toBe(group.id);
      expect(result[0].transaction_id).toBeNull();
    });

    it('should calculate group_item_count correctly', async () => {
      const user = await createTestUser(dataSource);
      const group = await createTestTransactionGroup(dataSource);

      // Create 5 transactions in the group
      for (let i = 0; i < 5; i++) {
        await createTestTransaction(dataSource, user, {
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          groupId: group.id,
        });
      }

      const query = selectTransactionNodesToSignForUser(sqlBuilder, user);
      const result = await dataSource.query(query.text, query.values);

      expect(result[0].group_item_count).toBe(5);
    });

    it('should calculate group_collected_count correctly', async () => {
      const user = await createTestUser(dataSource);
      const group = await createTestTransactionGroup(dataSource);

      // Create 5 transactions, but user has signed 2 already
      for (let i = 0; i < 5; i++) {
        const tx = await createTestTransaction(dataSource, user, {
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          groupId: group.id,
        });

        if (i < 2) {
          await createTransactionSigner(dataSource, tx, user.keys[0]);
        }
      }

      const query = selectTransactionNodesToSignForUser(sqlBuilder, user);
      const result = await dataSource.query(query.text, query.values);

      expect(result[0].group_item_count).toBe(5);
      expect(result[0].group_collected_count).toBe(3); // Only 3 need signing
    });

    it('should return uniform status when all transactions have same status', async () => {
      const user = await createTestUser(dataSource);
      const group = await createTestTransactionGroup(dataSource);

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        groupId: group.id,
      });
      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        groupId: group.id,
      });

      const query = selectTransactionNodesToSignForUser(sqlBuilder, user);
      const result = await dataSource.query(query.text, query.values);

      expect(result[0].status).toBe(TransactionStatus.WAITING_FOR_SIGNATURES);
    });

    it('should return null status when transactions have mixed statuses', async () => {
      const user = await createTestUser(dataSource);
      const group = await createTestTransactionGroup(dataSource);

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        groupId: group.id,
      });
      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        groupId: group.id,
      });

      const query = selectTransactionNodesToSignForUser(sqlBuilder, user);
      const result = await dataSource.query(query.text, query.values);

      expect(result[0].status).toBeNull();
    });

    it('should use group description when available', async () => {
      const user = await createTestUser(dataSource);
      const group = await createTestTransactionGroup(dataSource, {
        description: 'Group Description',
      });

      await createTestTransaction(dataSource, user, {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        description: 'Transaction Description',
        groupId: group.id,
      });

      const query = selectTransactionNodesToSignForUser(sqlBuilder, user);
      const result = await dataSource.query(query.text, query.values);

      expect(result[0].description).toBe('Group Description');
    });
  });

  describe('ordering', () => {
    it('should order by created_at DESC', async () => {
      const user = await createTestUser(dataSource);

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

      const query = selectTransactionNodesToSignForUser(sqlBuilder, user);
      const result = await dataSource.query(query.text, query.values);

      expect(result).toHaveLength(3);
      expect(result[0].transaction_id).toBe(tx2.id); // Most recent
      expect(result[1].transaction_id).toBe(tx3.id);
      expect(result[2].transaction_id).toBe(tx1.id); // Oldest
    });
  });
});

//TODO start here add in this stuff

// Helper functions to create test data
async function createTestUser(dataSource: DataSource): Promise<User> {
  const user = dataSource.getRepository(User).create({
    // Add required user fields
  });
  await dataSource.getRepository(User).save(user);

  const userKey = dataSource.getRepository(UserKey).create({
    userId: user.id,
    publicKey: 'test-public-key-' + Math.random(),
    // Add other required fields
  });
  await dataSource.getRepository(UserKey).save(userKey);

  user.keys = [userKey];
  return user;
}

async function createTestUserWithMultipleKeys(
  dataSource: DataSource,
  keyCount: number
): Promise<User> {
  const user = dataSource.getRepository(User).create({
    // Add required user fields
  });
  await dataSource.getRepository(User).save(user);

  const keys = [];
  for (let i = 0; i < keyCount; i++) {
    const userKey = dataSource.getRepository(UserKey).create({
      userId: user.id,
      publicKey: `test-public-key-${i}-${Math.random()}`,
      // Add other required fields
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
    createdAt?: Date;
    requireBothKeys?: boolean;
  }
): Promise<Transaction> {
  const transaction = dataSource.getRepository(Transaction).create({
    status: options.status,
    mirrorNetwork: options.mirrorNetwork,
    description: options.description || 'Test Transaction',
    createdAt: options.createdAt || new Date(),
    // Add other required fields
  });
  await dataSource.getRepository(Transaction).save(transaction);

  // Create cached account and link to user's key
  const cachedAccount = dataSource.getRepository(CachedAccount).create({
    // Add required fields
  });
  await dataSource.getRepository(CachedAccount).save(cachedAccount);

  const cachedAccountKey = dataSource.getRepository(CachedAccountKey).create({
    cachedAccountId: cachedAccount.id,
    publicKey: user.keys[0].publicKey,
    // Add other required fields
  });
  await dataSource.getRepository(CachedAccountKey).save(cachedAccountKey);

  if (options.requireBothKeys && user.keys[1]) {
    const cachedAccountKey2 = dataSource.getRepository(CachedAccountKey).create({
      cachedAccountId: cachedAccount.id,
      publicKey: user.keys[1].publicKey,
    });
    await dataSource.getRepository(CachedAccountKey).save(cachedAccountKey2);
  }

  const transactionCachedAccount = dataSource
    .getRepository(TransactionCachedAccount)
    .create({
      transactionId: transaction.id,
      cachedAccountId: cachedAccount.id,
    });
  await dataSource.getRepository(TransactionCachedAccount).save(transactionCachedAccount);

  // If part of a group, create group item
  if (options.groupId) {
    const groupItem = dataSource.getRepository(TransactionGroupItem).create({
      groupId: options.groupId,
      transactionId: transaction.id,
    });
    await dataSource.getRepository(TransactionGroupItem).save(groupItem);
  }

  return transaction;
}

async function createTestTransactionGroup(
  dataSource: DataSource,
  options?: { description?: string }
): Promise<TransactionGroup> {
  const group = dataSource.getRepository(TransactionGroup).create({
    description: options?.description || 'Test Group',
    createdAt: new Date(),
    // Add other required fields
  });
  await dataSource.getRepository(TransactionGroup).save(group);
  return group;
}

async function createTransactionSigner(
  dataSource: DataSource,
  transaction: Transaction,
  userKey: UserKey
): Promise<TransactionSigner> {
  const signer = dataSource.getRepository(TransactionSigner).create({
    transactionId: transaction.id,
    userKeyId: userKey.id,
  });
  await dataSource.getRepository(TransactionSigner).save(signer);
  return signer;
}
// import { EntityManager, Repository } from 'typeorm';
// import { SqlBuilderService } from '@app/common';
// import { selectTransactionIdsForUser } from './';
// import {
//   Transaction,
//   UserKey,
//   TransactionCachedAccount,
//   CachedAccount,
//   CachedAccountKey,
//   TransactionCachedNode,
//   CachedNode,
//   CachedNodeAdminKey,
// } from '@entities';
//
// describe('selectTransactionIdsForUser', () => {
//   let entityManager: EntityManager;
//   let sqlBuilder: SqlBuilderService;
//
//   // Create a mock entity manager with all required entities
//   beforeEach(() => {
//     const createMockMetadata = (tableName: string, columns: Record<string, string>) => ({
//       tableName,
//       findColumnWithPropertyName: (prop: string) => {
//         if (columns[prop]) {
//           return { databaseName: columns[prop], propertyName: prop };
//         }
//         return undefined;
//       },
//     });
//
//     const entityMetadataMap = new Map<any, any>([
//       [Transaction, createMockMetadata('transaction', { id: 'id' })],
//       [UserKey, createMockMetadata('user_key', { userId: 'user_id', publicKey: 'public_key' })],
//       [TransactionCachedAccount, createMockMetadata('transaction_account', { transactionId: 'transaction_id', accountId: 'account_id' })],
//       [CachedAccount, createMockMetadata('cached_account', { id: 'id' })],
//       [CachedAccountKey, createMockMetadata('cached_account_key', { accountId: 'account_id', publicKey: 'public_key' })],
//       [TransactionCachedNode, createMockMetadata('transaction_node', { transactionId: 'transaction_id', nodeId: 'node_id' })],
//       [CachedNode, createMockMetadata('cached_node', { id: 'id' })],
//       [CachedNodeAdminKey, createMockMetadata('cached_node_admin_key', { nodeId: 'node_id', publicKey: 'public_key' })],
//     ]);
//
//     entityManager = {
//       getRepository: jest.fn((entity: any) => {
//         const metadata = entityMetadataMap.get(entity);
//         if (metadata) {
//           return { metadata } as Repository<any>;
//         }
//         throw new Error(`Entity ${entity.name} not found`);
//       }),
//     } as unknown as EntityManager;
//
//     sqlBuilder = new SqlBuilderService(entityManager);
//   });
//
//   describe('SQL Generation', () => {
//     it('should return a non-empty SQL string', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql).toBeDefined();
//       expect(typeof sql).toBe('string');
//       expect(sql.length).toBeGreaterThan(0);
//     });
//   });
//
//   describe('SQL Keywords and Structure', () => {
//     it('should start with SELECT DISTINCT', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql.trim()).toMatch(/^SELECT\s+DISTINCT/i);
//     });
//
//     it('should contain all required table joins', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       // Main table
//       expect(sql).toContain('FROM transaction t');
//
//       // INNER JOIN
//       expect(sql).toContain('JOIN user_key uk');
//
//       // LEFT JOINs
//       expect(sql).toContain('LEFT JOIN transaction_account ta');
//       expect(sql).toContain('LEFT JOIN cached_account ca');
//       expect(sql).toContain('LEFT JOIN cached_account_key cak');
//       expect(sql).toContain('LEFT JOIN transaction_node tn');
//       expect(sql).toContain('LEFT JOIN cached_node cn');
//       expect(sql).toContain('LEFT JOIN cached_node_admin_key cnak');
//     });
//
//     it('should use parameterized query with $1 for userId', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql).toContain('$1');
//       expect(sql).toMatch(/uk\.user_id\s*=\s*\$1/);
//     });
//
//     it('should not contain SQL injection vulnerabilities (no string interpolation of values)', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       // Should only contain $1, no other $ placeholders or direct value injection
//       const placeholders = sql.match(/\$\d+/g) || [];
//       expect(placeholders).toEqual(['$1']);
//     });
//   });
//
//   describe('Table Name Usage', () => {
//     it('should call SqlBuilder.table() for all entities', () => {
//       const tableSpy = jest.spyOn(sqlBuilder, 'table');
//
//       selectTransactionIdsForUser(sqlBuilder);
//
//       expect(tableSpy).toHaveBeenCalledWith(Transaction);
//       expect(tableSpy).toHaveBeenCalledWith(UserKey);
//       expect(tableSpy).toHaveBeenCalledWith(TransactionCachedAccount);
//       expect(tableSpy).toHaveBeenCalledWith(CachedAccount);
//       expect(tableSpy).toHaveBeenCalledWith(CachedAccountKey);
//       expect(tableSpy).toHaveBeenCalledWith(TransactionCachedNode);
//       expect(tableSpy).toHaveBeenCalledWith(CachedNode);
//       expect(tableSpy).toHaveBeenCalledWith(CachedNodeAdminKey);
//     });
//
//     it('should use correct table names from SqlBuilder', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql).toContain('transaction t');
//       expect(sql).toContain('user_key uk');
//       expect(sql).toContain('transaction_account ta');
//       expect(sql).toContain('cached_account ca');
//       expect(sql).toContain('cached_account_key cak');
//       expect(sql).toContain('transaction_node tn');
//       expect(sql).toContain('cached_node cn');
//       expect(sql).toContain('cached_node_admin_key cnak');
//     });
//   });
//
//   describe('Column Name Usage', () => {
//     it('should call SqlBuilder.col() for all column references', () => {
//       const colSpy = jest.spyOn(sqlBuilder, 'col');
//
//       selectTransactionIdsForUser(sqlBuilder);
//
//       // Transaction columns
//       expect(colSpy).toHaveBeenCalledWith(Transaction, 'id');
//
//       // UserKey columns
//       expect(colSpy).toHaveBeenCalledWith(UserKey, 'userId');
//       expect(colSpy).toHaveBeenCalledWith(UserKey, 'publicKey');
//
//       // TransactionAccount columns
//       expect(colSpy).toHaveBeenCalledWith(TransactionCachedAccount, 'transactionId');
//       expect(colSpy).toHaveBeenCalledWith(TransactionCachedAccount, 'accountId');
//
//       // CachedAccount columns
//       expect(colSpy).toHaveBeenCalledWith(CachedAccount, 'id');
//
//       // CachedAccountKey columns
//       expect(colSpy).toHaveBeenCalledWith(CachedAccountKey, 'accountId');
//       expect(colSpy).toHaveBeenCalledWith(CachedAccountKey, 'publicKey');
//
//       // TransactionNode columns
//       expect(colSpy).toHaveBeenCalledWith(TransactionCachedNode, 'transactionId');
//       expect(colSpy).toHaveBeenCalledWith(TransactionCachedNode, 'nodeId');
//
//       // CachedNode columns
//       expect(colSpy).toHaveBeenCalledWith(CachedNode, 'id');
//
//       // CachedNodeAdminKey columns
//       expect(colSpy).toHaveBeenCalledWith(CachedNodeAdminKey, 'nodeId');
//       expect(colSpy).toHaveBeenCalledWith(CachedNodeAdminKey, 'publicKey');
//     });
//
//     it('should use correct column names from SqlBuilder', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql).toContain('t.id');
//       expect(sql).toContain('uk.user_id');
//       expect(sql).toContain('uk.public_key');
//       expect(sql).toContain('ta.transaction_id');
//       expect(sql).toContain('ta.account_id');
//       expect(sql).toContain('ca.id');
//       expect(sql).toContain('cak.account_id');
//       expect(sql).toContain('cak.public_key');
//       expect(sql).toContain('tn.transaction_id');
//       expect(sql).toContain('tn.node_id');
//       expect(sql).toContain('cn.id');
//       expect(sql).toContain('cnak.node_id');
//       expect(sql).toContain('cnak.public_key');
//     });
//   });
//
//   describe('JOIN Conditions', () => {
//     it('should have correct JOIN condition for UserKey', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql).toMatch(/JOIN user_key uk\s+ON uk\.user_id\s*=\s*\$1/);
//     });
//
//     it('should have correct JOIN condition for TransactionAccount', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql).toMatch(/LEFT JOIN transaction_account ta\s+ON ta\.transaction_id\s*=\s*t\.id/);
//     });
//
//     it('should have correct JOIN condition for CachedAccount', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql).toMatch(/LEFT JOIN cached_account ca\s+ON ca\.id\s*=\s*ta\.account_id/);
//     });
//
//     it('should have correct multi-condition JOIN for CachedAccountKey', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql).toMatch(/LEFT JOIN cached_account_key cak/);
//       expect(sql).toMatch(/cak\.account_id\s*=\s*ca\.id/);
//       expect(sql).toMatch(/cak\.public_key\s*=\s*uk\.public_key/);
//     });
//
//     it('should have correct JOIN condition for TransactionNode', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql).toMatch(/LEFT JOIN transaction_node tn\s+ON tn\.transaction_id\s*=\s*t\.id/);
//     });
//
//     it('should have correct JOIN condition for CachedNode', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql).toMatch(/LEFT JOIN cached_node cn\s+ON cn\.id\s*=\s*tn\.node_id/);
//     });
//
//     it('should have correct multi-condition JOIN for CachedNodeAdminKey', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql).toMatch(/LEFT JOIN cached_node_admin_key cnak/);
//       expect(sql).toMatch(/cnak\.node_id\s*=\s*cn\.id/);
//       expect(sql).toMatch(/cnak\.public_key\s*=\s*uk\.public_key/);
//     });
//   });
//
//   describe('Query Intent', () => {
//     it('should select only transaction IDs', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       // Should select t.id
//       expect(sql).toMatch(/SELECT\s+DISTINCT\s+t\.id/i);
//
//       // Should not select other columns
//       expect(sql).not.toMatch(/SELECT.*\*/);
//     });
//
//     it('should use DISTINCT to avoid duplicates', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql).toMatch(/SELECT\s+DISTINCT/i);
//     });
//
//     it('should join based on public key matching (account path)', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       // Account-based authorization path
//       expect(sql).toContain('cak.public_key = uk.public_key');
//     });
//
//     it('should join based on public key matching (node path)', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       // Node-based authorization path
//       expect(sql).toContain('cnak.public_key = uk.public_key');
//     });
//   });
//
//   describe('SQL Validity', () => {
//     it('should not have syntax errors (basic validation)', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       // Check for common SQL syntax issues
//       expect(sql).not.toContain(',,'); // Double commas
//       expect(sql).not.toContain('FROMFROM'); // Missing space
//       expect(sql).not.toContain('JOINON'); // Missing space
//
//       // Check for balanced structure
//       const selectCount = (sql.match(/SELECT/gi) || []).length;
//       const fromCount = (sql.match(/FROM/gi) || []).length;
//       expect(selectCount).toBe(fromCount); // Each SELECT should have a FROM
//     });
//
//     it('should have consistent alias usage', () => {
//       const sql = selectTransactionIdsForUser(sqlBuilder);
//
//       // Check that aliases defined in FROM/JOIN are actually used
//       const definedAliases = ['t', 'uk', 'ta', 'ca', 'cak', 'tn', 'cn', 'cnak'];
//
//       for (const alias of definedAliases) {
//         // Should appear in FROM/JOIN clause
//         expect(sql).toMatch(new RegExp(`\\b${alias}\\b`));
//
//         // Should be used in column references (e.g., t.id, uk.user_id)
//         expect(sql).toMatch(new RegExp(`${alias}\\.\\w+`));
//       }
//     });
//   });
//
//   describe('Error Handling', () => {
//     it('should throw if SqlBuilder throws for missing entity', () => {
//       const brokenEntityManager = {
//         getRepository: jest.fn(() => {
//           throw new Error('Entity not found');
//         }),
//       } as unknown as EntityManager;
//
//       const brokenSqlBuilder = new SqlBuilderService(brokenEntityManager);
//
//       expect(() => selectTransactionIdsForUser(brokenSqlBuilder)).toThrow();
//     });
//
//     it('should throw if SqlBuilder throws for missing column', () => {
//       const invalidMetadata = {
//         tableName: 'transaction',
//         findColumnWithPropertyName: jest.fn(() => undefined),
//       };
//
//       const invalidEntityManager = {
//         getRepository: jest.fn(() => ({
//           metadata: invalidMetadata,
//         })),
//       } as unknown as EntityManager;
//
//       const invalidSqlBuilder = new SqlBuilderService(invalidEntityManager);
//
//       expect(() => selectTransactionIdsForUser(invalidSqlBuilder)).toThrow();
//     });
//   });
//
//   describe('Idempotency', () => {
//     it('should return the same SQL when called multiple times', () => {
//       const sql1 = selectTransactionIdsForUser(sqlBuilder);
//       const sql2 = selectTransactionIdsForUser(sqlBuilder);
//       const sql3 = selectTransactionIdsForUser(sqlBuilder);
//
//       expect(sql1).toBe(sql2);
//       expect(sql2).toBe(sql3);
//     });
//
//     it('should not modify the SqlBuilder instance', () => {
//       const tableCallsBefore = (entityManager.getRepository as jest.Mock).mock.calls.length;
//
//       selectTransactionIdsForUser(sqlBuilder);
//       selectTransactionIdsForUser(sqlBuilder);
//
//       // SqlBuilder should cache, so second call shouldn't make new getRepository calls
//       const tableCallsAfter = (entityManager.getRepository as jest.Mock).mock.calls.length;
//       expect(tableCallsAfter).toBe(tableCallsBefore + 8); // 8 entities, but only called once due to cache
//     });
//   });
// });