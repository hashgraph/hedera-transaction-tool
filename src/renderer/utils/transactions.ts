import { Timestamp, Status } from '@hashgraph/sdk';
import { Transaction } from '@prisma/client';

export const getTransactionDate = (transaction: Transaction): string => {
  return new Timestamp(
    transaction.transaction_id.split('@')[1].split('.')[0],
    transaction.transaction_id.split('@')[1].split('.')[1],
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
