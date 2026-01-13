import { SqlBuilder } from '@app/common';
import {
  Transaction,
  UserKey,
  TransactionCachedAccount,
  CachedAccount,
  CachedAccountKey,
  TransactionCachedNode,
  CachedNode,
  CachedNodeAdminKey,
} from '@entities';

/**
 * Returns SQL (with a single $1 parameter for userId) that selects DISTINCT transaction ids
 * associated with any of the user's public keys.
 */
export function selectTransactionIdsForUser(sql: SqlBuilder): string {
  return `
    SELECT DISTINCT t.${sql.col(Transaction, 'id')}
    FROM ${sql.table(Transaction)} t

    JOIN ${sql.table(UserKey)} uk 
      ON uk.${sql.col(UserKey, 'userId')} = $1

    LEFT JOIN ${sql.table(TransactionCachedAccount)} ta 
      ON ta.${sql.col(TransactionCachedAccount, 'transactionId')} = t.${sql.col(Transaction, 'id')}
    LEFT JOIN ${sql.table(CachedAccount)} ca 
      ON ca.${sql.col(CachedAccount, 'id')} = ta.${sql.col(TransactionCachedAccount, 'accountId')}
    LEFT JOIN ${sql.table(CachedAccountKey)} cak 
      ON cak.${sql.col(CachedAccountKey, 'accountId')} = ca.${sql.col(CachedAccount, 'id')}
      AND cak.${sql.col(CachedAccountKey, 'publicKey')} = uk.${sql.col(UserKey, 'publicKey')}

    LEFT JOIN ${sql.table(TransactionCachedNode)} tn 
      ON tn.${sql.col(TransactionCachedNode, 'transactionId')} = t.${sql.col(Transaction, 'id')}
    LEFT JOIN ${sql.table(CachedNode)} cn 
      ON cn.${sql.col(CachedNode, 'id')} = tn.${sql.col(TransactionCachedNode, 'nodeId')}
    LEFT JOIN ${sql.table(CachedNodeAdminKey)} cnak 
      ON cnak.${sql.col(CachedNodeAdminKey, 'nodeId')} = cn.${sql.col(CachedNode, 'id')}
      AND cnak.${sql.col(CachedNodeAdminKey, 'publicKey')} = uk.${sql.col(UserKey, 'publicKey')}
  `;
}
