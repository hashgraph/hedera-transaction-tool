import { FreezeType, Transaction } from '@hashgraph/sdk';
import { getDateStringExtended } from '..';

export const getTransactionDate = (transaction: Transaction) =>
  transaction.transactionId?.validStart?.toDate().toDateString() || null;

export const getTransactionDateExtended = (transaction: Transaction) => {
  const validStart = transaction.transactionId?.validStart;
  if (!validStart) return null;

  return getDateStringExtended(validStart.toDate());
};

export const getTransactionId = (transaction: Transaction) => {
  if (!transaction.transactionId?.accountId || !transaction.transactionId?.validStart) {
    return null;
  }

  // return `${transaction.transactionId.accountId.toString()}@${transaction.transactionId.validStart.seconds.toString()}`;
  return transaction.transactionId?.toString();
};

export const getTransactionPayerId = (transaction: Transaction) =>
  transaction.transactionId?.accountId?.toString() || null;

export const getTransactionValidStart = (transaction: Transaction) =>
  transaction.transactionId?.validStart?.toDate() || null;

export const getTransactionType = (
  transaction: Transaction,
  short = false,
  removeTransaction = false,
) => {
  return transaction.constructor.name
    .slice(transaction.constructor.name.startsWith('_') ? 1 : 0)
    .split(/(?=[A-Z])/)
    .join(short ? '' : ' ')
    .replace(removeTransaction ? ' Transaction' : '', '');
};

export const getFreezeTypeString = (freezeType: FreezeType) => {
  switch (freezeType) {
    case FreezeType.FreezeOnly:
      return 'Freeze Only';
    case FreezeType.PrepareUpgrade:
      return 'Prepare Upgrade';
    case FreezeType.FreezeUpgrade:
      return 'Freeze Upgrade';
    case FreezeType.FreezeAbort:
      return 'Freeze Abort';
    case FreezeType.TelemetryUpgrade:
      return 'Telemetry Upgrade';
    default:
      return 'Unknown';
  }
};
