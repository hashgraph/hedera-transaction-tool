import { SqlBuilderService, SqlQuery } from '@app/common';
import {
  Transaction,
  UserKey,
  TransactionCachedAccount,
  CachedAccount,
  CachedAccountKey,
  TransactionCachedNode,
  CachedNode,
  CachedNodeAdminKey,
  User,
  TransactionGroupItem,
  TransactionSigner,
  TransactionGroup,
  TransactionStatus,
  TransactionObserver,
  TransactionApprover,
  TransactionType,
} from '@entities';

type TransactionFilters = {
  statuses: TransactionStatus[];
  types?: TransactionType[];
  mirrorNetwork?: string;
  onlyUnsigned?: boolean; // Optional flag, defaults to false
};

type Roles = {
  signer?: boolean;
  creator?: boolean;
  observer?: boolean;
  approver?: boolean;
};

interface WhereClauseResult {
  clause: string;
  values: any[];
}

const TERMINAL_STATUSES = [
  TransactionStatus.CANCELED,
  TransactionStatus.REJECTED,
  TransactionStatus.EXECUTED,
  TransactionStatus.FAILED,
  TransactionStatus.EXPIRED,
  TransactionStatus.ARCHIVED,
];

function buildFilterConditions(
  sql: SqlBuilderService,
  filters: TransactionFilters,
  addParam: (value: any) => string
): string[] {
  const conditions: string[] = [];

  // Status filter (always required)
  conditions.push(`t.${sql.col(Transaction, 'status')} = ANY(${addParam(filters.statuses)})`);

  // Type filter (optional)
  if (filters.types) {
    conditions.push(`t.${sql.col(Transaction, 'type')} = ANY(${addParam(filters.types)})`);
  }

  // Mirror network filter (optional)
  if (filters.mirrorNetwork) {
    conditions.push(`t.${sql.col(Transaction, 'mirrorNetwork')} = ${addParam(filters.mirrorNetwork)}`);
  }

  return conditions;
}

function buildEligibilityConditions(
  sql: SqlBuilderService,
  user: User,
  roles: Roles,
  addParam: (value: any) => string,
  onlyUnsigned: boolean,
): string[] {
  const eligibilityConditions: string[] = [];
  let cachedData: { keyIds: number[], publicKeys: string[] } | null = null;

  const getUserKeyData = () => {
    if (!cachedData) {
      const keyIds: number[] = [];
      const publicKeys: string[] = [];

      for (const key of user.keys) {
        keyIds.push(key.id);
        publicKeys.push(key.publicKey);
      }

      cachedData = { keyIds, publicKeys };
    }
    return cachedData;
  };

  if (roles.signer) {
    const { keyIds, publicKeys } = getUserKeyData();
    const keyParam = addParam(keyIds);
    const publicKeysParam = addParam(publicKeys);

    const branches: string[] = [];

    // Branch 1: Cached Account Keys
    const cachedAccountBranch = `
      EXISTS (
        SELECT 1
        FROM ${sql.table(TransactionCachedAccount)} ta
        JOIN ${sql.table(CachedAccount)} ca
          ON ca.${sql.col(CachedAccount, 'id')} = ta.${sql.col(TransactionCachedAccount, 'cachedAccountId')}
        JOIN ${sql.table(CachedAccountKey)} cak
          ON cak.${sql.col(CachedAccountKey, 'cachedAccountId')} = ca.${sql.col(CachedAccount, 'id')}
        JOIN ${sql.table(UserKey)} uk
          ON uk.${sql.col(UserKey, 'publicKey')} = cak.${sql.col(CachedAccountKey, 'publicKey')}
        WHERE ta.${sql.col(TransactionCachedAccount, 'transactionId')} = t.${sql.col(Transaction, 'id')}
          AND uk.${sql.col(UserKey, 'id')} = ANY(${keyParam})
          ${onlyUnsigned ? `
          AND NOT EXISTS (
            SELECT 1
            FROM ${sql.table(TransactionSigner)} ts
            WHERE ts.${sql.col(TransactionSigner, 'transactionId')} = t.${sql.col(Transaction, 'id')}
              AND ts.${sql.col(TransactionSigner, 'userKeyId')} = uk.${sql.col(UserKey, 'id')}
          )` : ''}
      )
    `;
    branches.push(cachedAccountBranch);

    // Branch 2: Cached Node Keys
    const cachedNodeBranch = `
      EXISTS (
        SELECT 1
        FROM ${sql.table(TransactionCachedNode)} tn
        JOIN ${sql.table(CachedNode)} cn
          ON cn.${sql.col(CachedNode, 'id')} = tn.${sql.col(TransactionCachedNode, 'cachedNodeId')}
        JOIN ${sql.table(CachedNodeAdminKey)} cnak
          ON cnak.${sql.col(CachedNodeAdminKey, 'cachedNodeId')} = cn.${sql.col(CachedNode, 'id')}
        JOIN ${sql.table(UserKey)} uk
          ON uk.${sql.col(UserKey, 'publicKey')} = cnak.${sql.col(CachedNodeAdminKey, 'publicKey')}
        WHERE tn.${sql.col(TransactionCachedNode, 'transactionId')} = t.${sql.col(Transaction, 'id')}
          AND uk.${sql.col(UserKey, 'id')} = ANY(${keyParam})
          ${onlyUnsigned ? `
          AND NOT EXISTS (
            SELECT 1
            FROM ${sql.table(TransactionSigner)} ts
            WHERE ts.${sql.col(TransactionSigner, 'transactionId')} = t.${sql.col(Transaction, 'id')}
              AND ts.${sql.col(TransactionSigner, 'userKeyId')} = uk.${sql.col(UserKey, 'id')}
          )` : ''}
      )
    `;
    branches.push(cachedNodeBranch);

    // Branch 3: Transaction Public Keys
    const publicKeysBranch = `
      (
        t.${sql.col(Transaction, 'publicKeys')} && ${publicKeysParam}
        ${onlyUnsigned ? `
        AND NOT EXISTS (
          SELECT 1
          FROM ${sql.table(TransactionSigner)} ts
          JOIN ${sql.table(UserKey)} uk
            ON uk.${sql.col(UserKey, 'id')} = ts.${sql.col(TransactionSigner, 'userKeyId')}
          WHERE ts.${sql.col(TransactionSigner, 'transactionId')} = t.${sql.col(Transaction, 'id')}
            AND uk.${sql.col(UserKey, 'publicKey')} = ANY(t.${sql.col(Transaction, 'publicKeys')})
            AND uk.${sql.col(UserKey, 'id')} = ANY(${keyParam})
        )` : ''}
      )
    `;
    branches.push(publicKeysBranch);

    // Combine all branches with OR
    eligibilityConditions.push(`(${branches.join(' OR ')})`);
  }

  if (roles.creator) {
    const keyParam = addParam(getUserKeyData().keyIds);
    eligibilityConditions.push(`t.${sql.col(Transaction, 'creatorKeyId')} = ANY(${keyParam})`);
  }

  if (roles.observer) {
    const userParam = addParam(user.id);
    eligibilityConditions.push(`
      EXISTS (
        SELECT 1
        FROM ${sql.table(TransactionObserver)} tobs
        WHERE tobs.${sql.col(TransactionObserver, 'transactionId')} = t.${sql.col(Transaction, 'id')}
          AND tobs.${sql.col(TransactionObserver, 'userId')} = ${userParam}
      )
    `);
  }

  if (roles.approver) {
    const userParam = addParam(user.id);
    eligibilityConditions.push(`
      (
        WITH RECURSIVE approverList AS (
          SELECT *
          FROM ${sql.table(TransactionApprover)}
          WHERE ${sql.col(TransactionApprover, 'transactionId')} = t.${sql.col(Transaction, 'id')}
          UNION ALL
          SELECT a.*
          FROM ${sql.table(TransactionApprover)} a
          JOIN approverList al ON al.${sql.col(TransactionApprover, 'id')} = a.${sql.col(TransactionApprover, 'listId')}
        )
        SELECT COUNT(*)::int FROM approverList
        WHERE approverList.${sql.col(TransactionApprover, 'deletedAt')} IS NULL
          AND approverList.${sql.col(TransactionApprover, 'userId')} = ${userParam}
      ) > 0
    `);
  }

  return eligibilityConditions;
}

/**
 * Builds a parameterized SQL WHERE clause for filtering and authorizing transaction queries.
 *
 * The resulting clause is structured as:
 * `(filter conditions) AND ((eligibility conditions) OR (terminal status override))`
 *
 * Terminal statuses (CANCELED, REJECTED, EXECUTED, FAILED, EXPIRED, ARCHIVED) always
 * pass the eligibility check regardless of user or role conditions.
 *
 * @param sql - The SQL builder service used to resolve table and column names.
 * @param filters - Optional filters to apply, such as status, type, and mirror network.
 * @param user - Optional user to scope results to. If provided, `roles` must also be supplied.
 * @param roles - Optional roles defining how the user may be eligible to see a transaction
 *                (e.g. as signer, creator, observer, or approver).
 * @returns A `WhereClauseResult` containing the SQL clause string and its corresponding parameter values.
 */
function buildWhereClause(
  sql: SqlBuilderService,
  filters?: TransactionFilters,
  user?: User,
  roles?: Roles
): WhereClauseResult {
  const conditions: string[] = [];
  const values: any[] = [];

  let paramIndex = 1;

  // Helper to add a parameter and get its $N reference
  const addParam = (value: any): string => {
    values.push(value);
    return `$${paramIndex++}`;
  };

  // Build filter conditions
  if (filters) {
    const filterConditions = buildFilterConditions(sql, filters, addParam);
    conditions.push(...filterConditions);
  }

  const eligibilityConditions: string[] = [];

  if (user && roles) {
    // Build eligibility conditions
    const userEligibility = buildEligibilityConditions(
      sql,
      user,
      roles,
      addParam,
      filters?.onlyUnsigned ?? false
    );

    eligibilityConditions.push(...userEligibility);
  }

  const statusParam = addParam(TERMINAL_STATUSES);
  eligibilityConditions.push(`t.${sql.col(Transaction, 'status')} = ANY(${statusParam})`);

  conditions.push(`(${eligibilityConditions.join(' OR ')})`);

  return {
    clause: conditions.join(' AND '),
    values,
  };
}

export function getTransactionNodesQuery(
  sql: SqlBuilderService,
  filters: TransactionFilters,
  user?: User,
  roles?: { signer?: boolean; creator?: boolean; observer?: boolean; approver?: boolean }
): SqlQuery {
  const whereResult = buildWhereClause(sql, filters, user, roles);

  const text = `
    WITH eligible_transactions AS (
      SELECT
        t.${sql.col(Transaction, 'id')} AS transaction_id,
        gi.${sql.col(TransactionGroupItem, 'groupId')} AS group_id,
        t.${sql.col(Transaction, 'description')} AS tx_description,
        t.${sql.col(Transaction, 'createdAt')} AS tx_created_at,
        t.${sql.col(Transaction, 'validStart')} AS tx_valid_start,
        t.${sql.col(Transaction, 'updatedAt')} AS tx_updated_at,
        t.${sql.col(Transaction, 'executedAt')} AS tx_executed_at,
        t.${sql.col(Transaction, 'status')} AS tx_status,
        t.${sql.col(Transaction, 'statusCode')} AS tx_status_code,
        t.${sql.col(Transaction, 'transactionId')} AS sdk_transaction_id,
        t.${sql.col(Transaction, 'type')} AS transaction_type,
        t.${sql.col(Transaction, 'isManual')} AS is_manual,
        ROW_NUMBER() OVER (
          PARTITION BY gi.${sql.col(TransactionGroupItem, 'groupId')}
          ORDER BY t.${sql.col(Transaction, 'createdAt')} DESC
        ) AS rn
      FROM ${sql.table(Transaction)} t
      LEFT JOIN ${sql.table(TransactionGroupItem)} gi
        ON gi.${sql.col(TransactionGroupItem, 'transactionId')} = t.${sql.col(Transaction, 'id')}
      WHERE ${whereResult.clause}   
    ),
    group_aggregates AS (
      SELECT
        group_id,
        COUNT(DISTINCT tx_status) AS distinct_statuses,
        MAX(tx_status) AS uniform_status,
        COUNT(DISTINCT tx_status_code) AS distinct_status_codes,
        MAX(tx_status_code) AS uniform_status_code,
        MIN(tx_valid_start) AS min_valid_start,
        MAX(tx_updated_at) AS max_updated_at,
        MAX(tx_executed_at) AS max_executed_at
      FROM eligible_transactions
      WHERE group_id IS NOT NULL
      GROUP BY group_id
    ),
    representative_transactions AS (
      SELECT
        transaction_id,
        group_id,
        tx_description,
        tx_created_at,
        tx_valid_start,
        tx_updated_at,
        tx_executed_at,
        tx_status,
        tx_status_code,
        sdk_transaction_id,
        transaction_type,
        is_manual
      FROM eligible_transactions
      WHERE group_id IS NULL OR rn = 1
    )
    SELECT
      CASE WHEN rt.group_id IS NULL THEN rt.transaction_id END AS transaction_id,
      rt.group_id AS group_id,
      COALESCE(tg.${sql.col(TransactionGroup, 'description')}, rt.tx_description) AS description,
      COALESCE(tg.${sql.col(TransactionGroup, 'createdAt')}, rt.tx_created_at) AS created_at,
      COALESCE(ga.min_valid_start, rt.tx_valid_start) AS valid_start,
      COALESCE(ga.max_updated_at, rt.tx_updated_at) AS updated_at,
      COALESCE(ga.max_executed_at, rt.tx_executed_at) AS executed_at,
      CASE
        WHEN rt.group_id IS NULL THEN rt.tx_status
        WHEN ga.distinct_statuses = 1 THEN ga.uniform_status
        ELSE NULL
      END AS status,
      CASE
        WHEN rt.group_id IS NULL THEN rt.tx_status_code
        WHEN ga.distinct_status_codes = 1 THEN ga.uniform_status_code
        ELSE NULL
      END AS status_code,
      CASE WHEN rt.group_id IS NULL THEN rt.sdk_transaction_id END AS sdk_transaction_id,
      CASE WHEN rt.group_id IS NULL THEN rt.transaction_type END AS transaction_type,
      CASE WHEN rt.group_id IS NULL THEN rt.is_manual END AS is_manual,
      (
        SELECT COUNT(*)::int
        FROM ${sql.table(TransactionGroupItem)} gi_all
        WHERE gi_all.${sql.col(TransactionGroupItem, 'groupId')} = rt.group_id
      ) AS group_item_count,
      (
        SELECT COUNT(DISTINCT transaction_id)::int
        FROM eligible_transactions et_inner
        WHERE et_inner.group_id = rt.group_id
      ) AS group_collected_count
    FROM representative_transactions rt
    LEFT JOIN ${sql.table(TransactionGroup)} tg
      ON tg.${sql.col(TransactionGroup, 'id')} = rt.group_id
    LEFT JOIN group_aggregates ga
      ON ga.group_id = rt.group_id
    ORDER BY rt.tx_created_at DESC
  `;

  return { text, values: whereResult.values };
}

export function getTransactionGroupItemsQuery(
  sql: SqlBuilderService,
  groupId: number,
  user?: User,
): SqlQuery {
  const whereResult = buildWhereClause(sql, undefined, user, { signer: true, creator: true, observer: true, approver: true });

  const values = [...whereResult.values];
  let paramIndex = values.length + 1;

  const groupIdParam = `$${paramIndex++}`;
  values.push(groupId);

  const text = `
    SELECT
      gi.${sql.col(TransactionGroupItem, 'seq')} AS gi_seq,
      t.${sql.col(Transaction, 'id')} AS tx_id,
      t.${sql.col(Transaction, 'name')} AS tx_name,
      t.${sql.col(Transaction, 'description')} AS tx_description,
      t.${sql.col(Transaction, 'transactionId')} AS sdk_transaction_id,
      t.${sql.col(Transaction, 'transactionHash')} AS tx_transaction_hash,
      t.${sql.col(Transaction, 'transactionBytes')} AS tx_transaction_bytes,
      t.${sql.col(Transaction, 'unsignedTransactionBytes')} AS tx_unsigned_transaction_bytes,
      t.${sql.col(Transaction, 'creatorKeyId')} AS tx_creator_key_id,
      t.${sql.col(Transaction, 'signature')} AS tx_signature,
      t.${sql.col(Transaction, 'mirrorNetwork')} AS tx_mirror_network,
      t.${sql.col(Transaction, 'cutoffAt')} AS tx_cutoff_at,
      t.${sql.col(Transaction, 'createdAt')} AS tx_created_at,
      t.${sql.col(Transaction, 'validStart')} AS tx_valid_start,
      t.${sql.col(Transaction, 'updatedAt')} AS tx_updated_at,
      t.${sql.col(Transaction, 'executedAt')} AS tx_executed_at,
      t.${sql.col(Transaction, 'status')} AS tx_status,
      t.${sql.col(Transaction, 'statusCode')} AS tx_status_code,
      t.${sql.col(Transaction, 'type')} AS tx_type,
      t.${sql.col(Transaction, 'isManual')} AS tx_is_manual,
      ck.${sql.col(UserKey, 'userId')} AS tx_creator_key_user_id,
      c.${sql.col(User, 'email')} AS tx_creator_email
    FROM ${sql.table(Transaction)} t
    INNER JOIN ${sql.table(TransactionGroupItem)} gi
      ON gi.${sql.col(TransactionGroupItem, 'transactionId')} = t.${sql.col(Transaction, 'id')}
      AND gi.${sql.col(TransactionGroupItem, 'groupId')} = ${groupIdParam}
    LEFT JOIN ${sql.table(UserKey)} ck
      ON ck.${sql.col(UserKey, 'id')} = t.${sql.col(Transaction, 'creatorKeyId')}
    LEFT JOIN ${sql.table(User)} c
      ON c.${sql.col(User, 'id')} = ck.${sql.col(UserKey, 'userId')}
    WHERE ${whereResult.clause}
    ORDER BY gi.${sql.col(TransactionGroupItem, 'seq')}
  `;

  return { text, values };
}