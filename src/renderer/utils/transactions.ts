import { Timestamp, Status } from '@hashgraph/sdk';
import { IStoredTransaction } from 'src/main/shared/interfaces';

export const getTransactionDate = (transaction: IStoredTransaction): string => {
  return new Timestamp(
    transaction.transactionId.split('@')[1].split('.')[0],
    transaction.transactionId.split('@')[1].split('.')[1],
  )
    .toDate()
    .toDateString();
};

export const getTransactionId = (transaction: IStoredTransaction): string => {
  return transaction.transactionId.split('@')[0];
};

export const getTransactionStatus = (transaction: IStoredTransaction): string => {
  return Status._fromCode(transaction.status).toString().split('_').join(' ');
};
