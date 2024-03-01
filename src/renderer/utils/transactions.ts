import {
  Timestamp,
  Status,
  TransactionReceipt,
  Transaction as Tx,
  TransactionId,
} from '@hashgraph/sdk';
import { Transaction } from '@prisma/client';

import { Network } from '@renderer/stores/storeNetwork';

import { openExternal } from '@renderer/services/electronUtilsService';

export const getTransactionDate = (transaction: Transaction): string => {
  return new Timestamp(
    Number(transaction.transaction_id.split('@')[1].split('.')[0]),
    Number(transaction.transaction_id.split('@')[1].split('.')[1]),
  )
    .toDate()
    .toDateString();
};

export const getTransactionId = (transaction: Transaction): string => {
  const transactionId = TransactionId.fromString(transaction.transaction_id);
  return `${transactionId.accountId?.toString()}@${transactionId.validStart?.seconds.toString()}`;
};

export const getTransactionPayerId = (transaction: Transaction): string => {
  return transaction.transaction_id.split('@')[0];
};

export const getTransactionValidStart = (transaction: Transaction) => {
  const transactionId = TransactionId.fromString(transaction.transaction_id);
  return transactionId.validStart;
};

export const getTransactionStatus = (transaction: Transaction): string => {
  try {
    return Status._fromCode(transaction.status_code).toString().split('_').join(' ');
  } catch (error) {
    return 'Unknown';
  }
};

export const getPayerFromTransaction = (transaction: Transaction): number => {
  return Number(transaction.transaction_id.split('@')[0].split('.').join(''));
};

export const getStatusFromCode = (transaction: Transaction): string => {
  try {
    return Status._fromCode(transaction.status_code).toString();
  } catch (error) {
    return 'Unknown';
  }
};

export const getFormattedDateFromTimestamp = (timestamp: Timestamp): string => {
  return new Date(timestamp.seconds.multiply(1000).toNumber()).toDateString();
};

export const openTransactionInHashscan = (transactionId, network: Network) => {
  network !== 'custom' &&
    openExternal(`https://hashscan.io/${network}/transaction/${transactionId}`);
};

export const getEntityIdFromTransactionReceipt = (
  receipt: TransactionReceipt,
  entityType: 'fileId' | 'accountId',
) => {
  const entity = receipt[entityType];

  if (!entity || entity === null) {
    throw new Error('No entity provided');
  }

  return entity.toString();
};

export const getTransactionType = (transaction: Tx | Uint8Array) => {
  if (transaction instanceof Uint8Array) {
    transaction = Tx.fromBytes(transaction);
  }

  return transaction.constructor.name
    .slice(transaction.constructor.name.startsWith('_') ? 1 : 0)
    .split(/(?=[A-Z])/)
    .join(' ');
};

/* Parses a transaction bytes string to a transaction */
export const getTransactionFromBytes = <T extends Tx>(transactionBytes: string): T => {
  const bytesArray = transactionBytes.split(',').map(n => Number(n));
  return Tx.fromBytes(Uint8Array.from(bytesArray)) as T;
};
