import {
  Timestamp,
  Status,
  TransactionReceipt,
  AccountId,
  TransactionResponse,
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
  return transaction.transaction_id.split('@')[0];
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
