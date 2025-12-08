import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import { DataSource, EntityManager, In, Repository } from 'typeorm';

import {
  MirrorNodeService,
  attachKeys,
  computeSignatureKey,
  flattenKeyList,
  notifySyncIndicators,
  NotifyGeneralDto,
  NOTIFY_GENERAL,
  notifyWaitingForSignatures,
  hasValidSignatureKey,
  smartCollate,
  SqlBuilder,
} from '@app/common';
import {
  User,
  Transaction,
  UserKey,
  TransactionStatus,
  NotificationType,
  TransactionAccount,
  CachedAccount,
  CachedAccountKey,
  TransactionNode,
  CachedNode,
  CachedNodeAdminKey,
} from '@entities';
import { ClientProxy } from '@nestjs/microservices';

export const keysRequiredToSign = async (
  transaction: Transaction,
  mirrorNodeService: MirrorNodeService,
  entityManager: EntityManager,
  userKeys?: UserKey[],
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
    results = await entityManager.find(UserKey, {
      where: {
        publicKey: In(flatPublicKeys),
      },
    });
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

export const getNetwork = (transaction: Transaction) => {
  const network = transaction.mirrorNetwork;
  const defaultNetworks = ['mainnet', 'testnet', 'previewnet', 'local-node'];
  const isCustom = !defaultNetworks.includes(network);
  const networkString = isCustom
    ? network
    : network.charAt(0).toUpperCase() + network.slice(1).toLowerCase();
  return networkString;
};

/* Checks if the signers are enough to sign the transaction and update its status */
export async function processTransactionStatus(
  transactionRepo: Repository<Transaction>,
  mirrorNodeService: MirrorNodeService,
  transaction: Transaction,
): Promise<TransactionStatus | undefined> {
  /* Returns if the transaction is null */
  if (!transaction) return;

  /* Gets the SDK transaction from the transaction body */
  const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

  /* Gets the signature key */
  const signatureKey = await computeSignatureKey(
    sdkTransaction,
    mirrorNodeService,
    transaction.mirrorNetwork,
  );

  /* Checks if the transaction has a valid signature */
  const isAbleToSign = hasValidSignatureKey([...sdkTransaction._signerPublicKeys], signatureKey);

  let newStatus = TransactionStatus.WAITING_FOR_SIGNATURES;

  if (isAbleToSign) {
    const sdkTransaction = await smartCollate(transaction, mirrorNodeService);

    if (sdkTransaction !== null) {
      newStatus = TransactionStatus.WAITING_FOR_EXECUTION;
    }
  }

  if (transaction.status !== newStatus) {
    await transactionRepo.update({ id: transaction.id }, { status: newStatus });
    return newStatus;
  }
}

export function notifyStatusChange(
  notificationsService: ClientProxy,
  transaction: Transaction,
  newStatus: TransactionStatus
) {
  notifySyncIndicators(notificationsService, transaction.id, newStatus, {
    network: transaction.mirrorNetwork,
  });
  if (newStatus === TransactionStatus.WAITING_FOR_EXECUTION) {
    notificationsService.emit<undefined, NotifyGeneralDto>(NOTIFY_GENERAL, {
      entityId: transaction.id,
      type: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
      actorId: null,
      userIds: [transaction.creatorKey?.userId],
      additionalData: { transactionId: transaction.transactionId, network: transaction.mirrorNetwork },
    });
  }

  if (newStatus === TransactionStatus.WAITING_FOR_SIGNATURES) {
    notifyWaitingForSignatures(notificationsService, transaction.id, {
      transactionId: transaction.transactionId,
      network: transaction.mirrorNetwork,
    });
  }
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
