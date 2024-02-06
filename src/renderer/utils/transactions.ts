import { Timestamp, Status } from '@hashgraph/sdk';
import { Transaction } from '@prisma/client';

import { Network } from '../stores/storeNetwork';

import { openExternal } from '../services/electronUtilsService';

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
