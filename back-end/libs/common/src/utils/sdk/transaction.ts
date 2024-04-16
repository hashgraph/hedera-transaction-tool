import { Transaction } from '@hashgraph/sdk';

export const isExpired = (transaction: Transaction) => {
  const validStart = transaction.transactionId.validStart.toDate();
  const duration = transaction.transactionValidDuration;

  return new Date().getTime() >= validStart.getTime() + duration;
};
