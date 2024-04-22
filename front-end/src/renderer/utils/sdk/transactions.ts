import { Transaction } from '@hashgraph/sdk';

export const getTransactionDate = (transaction: Transaction) =>
  transaction.transactionId?.validStart?.toDate().toDateString() || null;

export const getTransactionDateExtended = (transaction: Transaction) => {
  const validStart = transaction.transactionId?.validStart;
  if (!validStart) return null;

  return `${validStart.toDate().toDateString()} ${validStart.toDate().toLocaleTimeString()}`;
};

export const getTransactionId = (transaction: Transaction) => {
  if (!transaction.transactionId?.accountId || !transaction.transactionId?.validStart) {
    return null;
  }

  return `${transaction.transactionId.accountId.toString()}@${transaction.transactionId.validStart.seconds.toString()}`;
};

export const getTransactionPayerId = (transaction: Transaction) =>
  transaction.transactionId?.accountId?.toString() || null;

export const getTransactionValidStart = (transaction: Transaction) =>
  transaction.transactionId?.validStart?.toDate() || null;

export const getTransactionType = (transaction: Transaction, short = false) => {
  return transaction.constructor.name
    .slice(transaction.constructor.name.startsWith('_') ? 1 : 0)
    .split(/(?=[A-Z])/)
    .join(short ? '' : ' ');
};
