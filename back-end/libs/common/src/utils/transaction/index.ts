import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import { DataSource, EntityManager, In, Repository } from 'typeorm';

import {
  MirrorNodeService,
  attachKeys,
  computeSignatureKey,
  flattenKeyList,
  hasValidSignatureKey,
  smartCollate,
  SqlBuilder,
} from '@app/common';
import {
  User,
  Transaction,
  UserKey,
  TransactionStatus,
  TransactionAccount,
  CachedAccount,
  CachedAccountKey,
  TransactionNode,
  CachedNode,
  CachedNodeAdminKey,
} from '@entities';

export const keysRequiredToSign = async (
  transaction: Transaction,
  mirrorNodeService: MirrorNodeService,
  entityManager: EntityManager,
  userKeys?: UserKey[],
  cache?: Map<string, UserKey>,
): Promise<UserKey[]> => {
  if (!transaction) return [];

  /* Deserialize the transaction */
  const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

  // list of just public keys that have already signed the transaction
  const signerKeys = sdkTransaction._signerPublicKeys;

  const signature = await computeSignatureKey(sdkTransaction, mirrorNodeService, transaction.mirrorNetwork);
  // flatten the key list to an array of public keys
  // and filter out any keys that have already signed the transaction
  const flatPublicKeys = flattenKeyList(signature)
    .map(pk => pk.toStringRaw())
    .filter(pk => !signerKeys.has(pk));

  if (flatPublicKeys.length === 0) return [];

  let results: UserKey[] = [];
  // Now if userKeys is provided, filter out any keys that are not in the flatPublicKeys array
  // this way a user requesting required keys will only see their own keys that are required
  // Otherwise, fetch all UserKeys that are in flatPublicKeys
  if (userKeys) {
    results = userKeys.filter(publicKey =>
        flatPublicKeys.includes(publicKey.publicKey)
    );
  } else {
    if (cache) {
      const cachedKeys: Set<UserKey> = new Set();
      const missingPublicKeys: Set<string> = new Set();

      for (const publicKey of flatPublicKeys) {
        const cached = cache.get(publicKey);
        if (cached) {
          cachedKeys.add(cached);
        } else {
          missingPublicKeys.add(publicKey);
        }
      }

      let fetchedKeys: UserKey[] = [];
      if (missingPublicKeys.size > 0) {
        try {
          fetchedKeys = await entityManager.find(UserKey, {
            where: { publicKey: In([...missingPublicKeys]) },
            relations: ['user'],
          });
          // Store fetched keys in cache
          for (const key of fetchedKeys) {
            cache.set(key.publicKey, key);
          }
        } catch (error) {
          console.error('Error fetching missing user keys:', error);
          throw error;
        }
      }

      results = [...cachedKeys, ...fetchedKeys];
    } else {
      results = await entityManager.find(UserKey, {
        where: { publicKey: In(flatPublicKeys) },
        relations: ['user'],
      });
    }
  }

  return results;
};

export const userKeysRequiredToSign = async (
  transaction: Transaction,
  user: User,
  mirrorNodeService: MirrorNodeService,
  entityManager: EntityManager,
): Promise<number[]> => {
  await attachKeys(user, entityManager);
  if (user.keys.length === 0) return [];

  const userKeysRequiredToSign = await keysRequiredToSign(
    transaction,
    mirrorNodeService,
    entityManager,
    user.keys,
  );

  return userKeysRequiredToSign.map(k => k.id);
};

/* Checks if the signers are enough to sign the transaction and update its status */
export async function processTransactionStatus(
  transactionRepo: Repository<Transaction>,
  mirrorNodeService: MirrorNodeService,
  transactions: Transaction[],
): Promise<Map<number, TransactionStatus>> {
  const statusChanges = new Map<number, TransactionStatus>();
  const updatesByStatus = new Map<TransactionStatus, number[]>();

  // Process all transactions and group updates as we go
  for (const transaction of transactions) {
    if (!transaction) continue;

    const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

    const signatureKey = await computeSignatureKey(
      sdkTransaction,
      mirrorNodeService,
      transaction.mirrorNetwork,
    );

    const isAbleToSign = hasValidSignatureKey(
      [...sdkTransaction._signerPublicKeys],
      signatureKey
    );

    let newStatus = TransactionStatus.WAITING_FOR_SIGNATURES;

    if (isAbleToSign) {
      const collatedTx = await smartCollate(transaction, mirrorNodeService);

      if (collatedTx !== null) {
        newStatus = TransactionStatus.WAITING_FOR_EXECUTION;
      }
    }

    if (transaction.status !== newStatus) {
      // Track what changed (for return value)
      statusChanges.set(transaction.id, newStatus);

      // Group by status for bulk update
      if (!updatesByStatus.has(newStatus)) {
        updatesByStatus.set(newStatus, []);
      }
      updatesByStatus.get(newStatus)!.push(transaction.id);
    }
  }

  // Execute one update per unique status
  if (updatesByStatus.size > 0) {
    await Promise.all(
      Array.from(updatesByStatus.entries()).map(([status, ids]) =>
        transactionRepo.update({ id: In(ids) }, { status })
      )
    );
  }

  return statusChanges;
}

/**
 * Returns all transactions associated with ANY of the user's public keys.
 */
export async function getTransactionsForUser(dataSource: DataSource, userId: number): Promise<Transaction[]> {
  const sql = new SqlBuilder(dataSource);
  const query = `
    SELECT DISTINCT t.${sql.col(Transaction, 'id')}
    FROM ${sql.table(Transaction)} t
  
    JOIN ${sql.table(UserKey)} uk 
      ON uk.${sql.col(UserKey, 'userId')} = $1
  
    LEFT JOIN ${sql.table(TransactionAccount)} ta 
      ON ta.${sql.col(TransactionAccount, 'transactionId')} = t.${sql.col(Transaction, 'id')}
    LEFT JOIN ${sql.table(CachedAccount)} ca 
      ON ca.${sql.col(CachedAccount, 'id')} = ta.${sql.col(TransactionAccount, 'accountId')}
    LEFT JOIN ${sql.table(CachedAccountKey)} cak 
      ON cak.${sql.col(CachedAccountKey, 'accountId')} = ca.${sql.col(CachedAccount, 'id')}
      AND cak.${sql.col(CachedAccountKey, 'publicKey')} = uk.${sql.col(UserKey, 'publicKey')}
  
    LEFT JOIN ${sql.table(TransactionNode)} tn 
      ON tn.${sql.col(TransactionNode, 'transactionId')} = t.${sql.col(Transaction, 'id')}
    LEFT JOIN ${sql.table(CachedNode)} cn 
      ON cn.${sql.col(CachedNode, 'id')} = tn.${sql.col(TransactionNode, 'nodeId')}
    LEFT JOIN ${sql.table(CachedNodeAdminKey)} cnak 
      ON cnak.${sql.col(CachedNodeAdminKey, 'nodeId')} = cn.${sql.col(CachedNode, 'id')}
      AND cnak.${sql.col(CachedNodeAdminKey, 'publicKey')} = uk.${sql.col(UserKey, 'publicKey')}
  `;

  const rows = await this.em.query(query, [userId]);

  if (!rows.length) return [];

  const ids = rows.map(r => r.id);

  return this.txRepo.find({
    where: { id: In(ids) },
    relations: {
      payer: true,
      signatures: true,
      operations: true,
    },
  });
}
