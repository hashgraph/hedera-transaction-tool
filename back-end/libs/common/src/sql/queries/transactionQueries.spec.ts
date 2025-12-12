import { EntityManager, Repository } from 'typeorm';
import { SqlBuilder } from '@app/common';
import { selectTransactionIdsForUser } from './';
import {
  Transaction,
  UserKey,
  TransactionAccount,
  CachedAccount,
  CachedAccountKey,
  TransactionNode,
  CachedNode,
  CachedNodeAdminKey,
} from '@entities';

describe('selectTransactionIdsForUser', () => {
  let entityManager: EntityManager;
  let sqlBuilder: SqlBuilder;

  // Create a mock entity manager with all required entities
  beforeEach(() => {
    const createMockMetadata = (tableName: string, columns: Record<string, string>) => ({
      tableName,
      findColumnWithPropertyName: (prop: string) => {
        if (columns[prop]) {
          return { databaseName: columns[prop], propertyName: prop };
        }
        return undefined;
      },
    });

    const entityMetadataMap = new Map<any, any>([
      [Transaction, createMockMetadata('transaction', { id: 'id' })],
      [UserKey, createMockMetadata('user_key', { userId: 'user_id', publicKey: 'public_key' })],
      [TransactionAccount, createMockMetadata('transaction_account', { transactionId: 'transaction_id', accountId: 'account_id' })],
      [CachedAccount, createMockMetadata('cached_account', { id: 'id' })],
      [CachedAccountKey, createMockMetadata('cached_account_key', { accountId: 'account_id', publicKey: 'public_key' })],
      [TransactionNode, createMockMetadata('transaction_node', { transactionId: 'transaction_id', nodeId: 'node_id' })],
      [CachedNode, createMockMetadata('cached_node', { id: 'id' })],
      [CachedNodeAdminKey, createMockMetadata('cached_node_admin_key', { nodeId: 'node_id', publicKey: 'public_key' })],
    ]);

    entityManager = {
      getRepository: jest.fn((entity: any) => {
        const metadata = entityMetadataMap.get(entity);
        if (metadata) {
          return { metadata } as Repository<any>;
        }
        throw new Error(`Entity ${entity.name} not found`);
      }),
    } as unknown as EntityManager;

    sqlBuilder = new SqlBuilder(entityManager);
  });

  describe('SQL Generation', () => {
    it('should return a non-empty SQL string', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      expect(sql).toBeDefined();
      expect(typeof sql).toBe('string');
      expect(sql.length).toBeGreaterThan(0);
    });
  });

  describe('SQL Keywords and Structure', () => {
    it('should start with SELECT DISTINCT', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      expect(sql.trim()).toMatch(/^SELECT\s+DISTINCT/i);
    });

    it('should contain all required table joins', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      // Main table
      expect(sql).toContain('FROM transaction t');

      // INNER JOIN
      expect(sql).toContain('JOIN user_key uk');

      // LEFT JOINs
      expect(sql).toContain('LEFT JOIN transaction_account ta');
      expect(sql).toContain('LEFT JOIN cached_account ca');
      expect(sql).toContain('LEFT JOIN cached_account_key cak');
      expect(sql).toContain('LEFT JOIN transaction_node tn');
      expect(sql).toContain('LEFT JOIN cached_node cn');
      expect(sql).toContain('LEFT JOIN cached_node_admin_key cnak');
    });

    it('should use parameterized query with $1 for userId', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      expect(sql).toContain('$1');
      expect(sql).toMatch(/uk\.user_id\s*=\s*\$1/);
    });

    it('should not contain SQL injection vulnerabilities (no string interpolation of values)', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      // Should only contain $1, no other $ placeholders or direct value injection
      const placeholders = sql.match(/\$\d+/g) || [];
      expect(placeholders).toEqual(['$1']);
    });
  });

  describe('Table Name Usage', () => {
    it('should call SqlBuilder.table() for all entities', () => {
      const tableSpy = jest.spyOn(sqlBuilder, 'table');

      selectTransactionIdsForUser(sqlBuilder);

      expect(tableSpy).toHaveBeenCalledWith(Transaction);
      expect(tableSpy).toHaveBeenCalledWith(UserKey);
      expect(tableSpy).toHaveBeenCalledWith(TransactionAccount);
      expect(tableSpy).toHaveBeenCalledWith(CachedAccount);
      expect(tableSpy).toHaveBeenCalledWith(CachedAccountKey);
      expect(tableSpy).toHaveBeenCalledWith(TransactionNode);
      expect(tableSpy).toHaveBeenCalledWith(CachedNode);
      expect(tableSpy).toHaveBeenCalledWith(CachedNodeAdminKey);
    });

    it('should use correct table names from SqlBuilder', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      expect(sql).toContain('transaction t');
      expect(sql).toContain('user_key uk');
      expect(sql).toContain('transaction_account ta');
      expect(sql).toContain('cached_account ca');
      expect(sql).toContain('cached_account_key cak');
      expect(sql).toContain('transaction_node tn');
      expect(sql).toContain('cached_node cn');
      expect(sql).toContain('cached_node_admin_key cnak');
    });
  });

  describe('Column Name Usage', () => {
    it('should call SqlBuilder.col() for all column references', () => {
      const colSpy = jest.spyOn(sqlBuilder, 'col');

      selectTransactionIdsForUser(sqlBuilder);

      // Transaction columns
      expect(colSpy).toHaveBeenCalledWith(Transaction, 'id');

      // UserKey columns
      expect(colSpy).toHaveBeenCalledWith(UserKey, 'userId');
      expect(colSpy).toHaveBeenCalledWith(UserKey, 'publicKey');

      // TransactionAccount columns
      expect(colSpy).toHaveBeenCalledWith(TransactionAccount, 'transactionId');
      expect(colSpy).toHaveBeenCalledWith(TransactionAccount, 'accountId');

      // CachedAccount columns
      expect(colSpy).toHaveBeenCalledWith(CachedAccount, 'id');

      // CachedAccountKey columns
      expect(colSpy).toHaveBeenCalledWith(CachedAccountKey, 'accountId');
      expect(colSpy).toHaveBeenCalledWith(CachedAccountKey, 'publicKey');

      // TransactionNode columns
      expect(colSpy).toHaveBeenCalledWith(TransactionNode, 'transactionId');
      expect(colSpy).toHaveBeenCalledWith(TransactionNode, 'nodeId');

      // CachedNode columns
      expect(colSpy).toHaveBeenCalledWith(CachedNode, 'id');

      // CachedNodeAdminKey columns
      expect(colSpy).toHaveBeenCalledWith(CachedNodeAdminKey, 'nodeId');
      expect(colSpy).toHaveBeenCalledWith(CachedNodeAdminKey, 'publicKey');
    });

    it('should use correct column names from SqlBuilder', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      expect(sql).toContain('t.id');
      expect(sql).toContain('uk.user_id');
      expect(sql).toContain('uk.public_key');
      expect(sql).toContain('ta.transaction_id');
      expect(sql).toContain('ta.account_id');
      expect(sql).toContain('ca.id');
      expect(sql).toContain('cak.account_id');
      expect(sql).toContain('cak.public_key');
      expect(sql).toContain('tn.transaction_id');
      expect(sql).toContain('tn.node_id');
      expect(sql).toContain('cn.id');
      expect(sql).toContain('cnak.node_id');
      expect(sql).toContain('cnak.public_key');
    });
  });

  describe('JOIN Conditions', () => {
    it('should have correct JOIN condition for UserKey', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      expect(sql).toMatch(/JOIN user_key uk\s+ON uk\.user_id\s*=\s*\$1/);
    });

    it('should have correct JOIN condition for TransactionAccount', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      expect(sql).toMatch(/LEFT JOIN transaction_account ta\s+ON ta\.transaction_id\s*=\s*t\.id/);
    });

    it('should have correct JOIN condition for CachedAccount', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      expect(sql).toMatch(/LEFT JOIN cached_account ca\s+ON ca\.id\s*=\s*ta\.account_id/);
    });

    it('should have correct multi-condition JOIN for CachedAccountKey', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      expect(sql).toMatch(/LEFT JOIN cached_account_key cak/);
      expect(sql).toMatch(/cak\.account_id\s*=\s*ca\.id/);
      expect(sql).toMatch(/cak\.public_key\s*=\s*uk\.public_key/);
    });

    it('should have correct JOIN condition for TransactionNode', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      expect(sql).toMatch(/LEFT JOIN transaction_node tn\s+ON tn\.transaction_id\s*=\s*t\.id/);
    });

    it('should have correct JOIN condition for CachedNode', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      expect(sql).toMatch(/LEFT JOIN cached_node cn\s+ON cn\.id\s*=\s*tn\.node_id/);
    });

    it('should have correct multi-condition JOIN for CachedNodeAdminKey', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      expect(sql).toMatch(/LEFT JOIN cached_node_admin_key cnak/);
      expect(sql).toMatch(/cnak\.node_id\s*=\s*cn\.id/);
      expect(sql).toMatch(/cnak\.public_key\s*=\s*uk\.public_key/);
    });
  });

  describe('Query Intent', () => {
    it('should select only transaction IDs', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      // Should select t.id
      expect(sql).toMatch(/SELECT\s+DISTINCT\s+t\.id/i);

      // Should not select other columns
      expect(sql).not.toMatch(/SELECT.*\*/);
    });

    it('should use DISTINCT to avoid duplicates', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      expect(sql).toMatch(/SELECT\s+DISTINCT/i);
    });

    it('should join based on public key matching (account path)', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      // Account-based authorization path
      expect(sql).toContain('cak.public_key = uk.public_key');
    });

    it('should join based on public key matching (node path)', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      // Node-based authorization path
      expect(sql).toContain('cnak.public_key = uk.public_key');
    });
  });

  describe('SQL Validity', () => {
    it('should not have syntax errors (basic validation)', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      // Check for common SQL syntax issues
      expect(sql).not.toContain(',,'); // Double commas
      expect(sql).not.toContain('FROMFROM'); // Missing space
      expect(sql).not.toContain('JOINON'); // Missing space

      // Check for balanced structure
      const selectCount = (sql.match(/SELECT/gi) || []).length;
      const fromCount = (sql.match(/FROM/gi) || []).length;
      expect(selectCount).toBe(fromCount); // Each SELECT should have a FROM
    });

    it('should have consistent alias usage', () => {
      const sql = selectTransactionIdsForUser(sqlBuilder);

      // Check that aliases defined in FROM/JOIN are actually used
      const definedAliases = ['t', 'uk', 'ta', 'ca', 'cak', 'tn', 'cn', 'cnak'];

      for (const alias of definedAliases) {
        // Should appear in FROM/JOIN clause
        expect(sql).toMatch(new RegExp(`\\b${alias}\\b`));

        // Should be used in column references (e.g., t.id, uk.user_id)
        expect(sql).toMatch(new RegExp(`${alias}\\.\\w+`));
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw if SqlBuilder throws for missing entity', () => {
      const brokenEntityManager = {
        getRepository: jest.fn(() => {
          throw new Error('Entity not found');
        }),
      } as unknown as EntityManager;

      const brokenSqlBuilder = new SqlBuilder(brokenEntityManager);

      expect(() => selectTransactionIdsForUser(brokenSqlBuilder)).toThrow();
    });

    it('should throw if SqlBuilder throws for missing column', () => {
      const invalidMetadata = {
        tableName: 'transaction',
        findColumnWithPropertyName: jest.fn(() => undefined),
      };

      const invalidEntityManager = {
        getRepository: jest.fn(() => ({
          metadata: invalidMetadata,
        })),
      } as unknown as EntityManager;

      const invalidSqlBuilder = new SqlBuilder(invalidEntityManager);

      expect(() => selectTransactionIdsForUser(invalidSqlBuilder)).toThrow();
    });
  });

  describe('Idempotency', () => {
    it('should return the same SQL when called multiple times', () => {
      const sql1 = selectTransactionIdsForUser(sqlBuilder);
      const sql2 = selectTransactionIdsForUser(sqlBuilder);
      const sql3 = selectTransactionIdsForUser(sqlBuilder);

      expect(sql1).toBe(sql2);
      expect(sql2).toBe(sql3);
    });

    it('should not modify the SqlBuilder instance', () => {
      const tableCallsBefore = (entityManager.getRepository as jest.Mock).mock.calls.length;

      selectTransactionIdsForUser(sqlBuilder);
      selectTransactionIdsForUser(sqlBuilder);

      // SqlBuilder should cache, so second call shouldn't make new getRepository calls
      const tableCallsAfter = (entityManager.getRepository as jest.Mock).mock.calls.length;
      expect(tableCallsAfter).toBe(tableCallsBefore + 8); // 8 entities, but only called once due to cache
    });
  });
});