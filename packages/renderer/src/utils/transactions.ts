import type {TransactionReceipt, TransactionResponse} from '@hashgraph/sdk';
import {Timestamp, Status, AccountId, Transaction as Tx} from '@hashgraph/sdk';
import type {Transaction} from '@prisma/client';

import type {Network} from '@renderer/stores/storeNetwork';

import {openExternal} from '@renderer/services/electronUtilsService';
import type {HederaSpecialFileId} from '../../../../types/interfaces';

export const getTransactionDate = (transaction: Transaction): string => {
  return new Timestamp(
    Number(transaction.transaction_id.split('@')[1].split('.')[0]),
    Number(transaction.transaction_id.split('@')[1].split('.')[1]),
  )
    .toDate()
    .toDateString();
};

export const getTransactionId = (transaction: Transaction): string => {
  return transaction.transaction_id.split('@')[0];
};

export const getTransactionStatus = (transaction: Transaction): string => {
  return Status._fromCode(transaction.status_code).toString().split('_').join(' ');
};

export const getPayerFromTransaction = (transaction: Transaction): number => {
  return Number(transaction.transaction_id.split('@')[0].split('.').join(''));
};

export const getStatusFromCode = (transaction: Transaction): string => {
  return Status._fromCode(transaction.status_code).toString();
};

export const getFormattedDateFromTimestamp = (timestamp: Timestamp): string => {
  return new Date(timestamp.seconds.multiply(1000).toNumber()).toDateString();
};

export const openTransactionInHashscan = (transactionId, network: Network) => {
  network !== 'custom' &&
    openExternal(`https://hashscan.io/${network}/transaction/${transactionId}`);
};

export const getEntityIdFromTransactionResult = (
  result: {
    response: TransactionResponse;
    receipt: TransactionReceipt;
    transactionId: string;
  },
  entityType: 'fileId' | 'accountId',
) => {
  if (!result.receipt[entityType]) {
    throw new Error('No entity provided');
  }

  const entity = result.receipt[entityType];

  return new AccountId(entity as any).toString();
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

export function isHederaSpecialFileId(value: any): value is HederaSpecialFileId {
  const validValues: HederaSpecialFileId[] = [
    '0.0.101',
    '0.0.102',
    '0.0.111',
    '0.0.112',
    '0.0.121',
    '0.0.122',
    '0.0.123',
  ];

  return validValues.includes(value);
}
