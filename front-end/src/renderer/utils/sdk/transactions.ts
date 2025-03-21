import {
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountUpdateTransaction,
  FileCreateTransaction,
  FileDeleteTransaction,
  FileUpdateTransaction,
  FreezeTransaction,
  FreezeType,
  ScheduleCreateTransaction,
  ScheduleSignTransaction,
  Transaction,
  TransferTransaction
} from '@hashgraph/sdk';
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
  transaction: Transaction | Uint8Array,
  short = false,
  removeTransaction = false,
): string => {
  if (transaction instanceof Uint8Array) {
    transaction = Transaction.fromBytes(transaction);
  }

  let type = '';
//_getLogId
  if (transaction instanceof TransferTransaction) {
    type = 'Transfer Transaction';
  } else if (transaction instanceof AccountCreateTransaction) {
    type = 'Account Create Transaction';
  } else if (transaction instanceof AccountUpdateTransaction) {
    type = 'Account Update Transaction';
  } else if (transaction instanceof AccountDeleteTransaction) {
    type = 'Account Delete Transaction';
  } else if (transaction instanceof FileCreateTransaction) {
    type = 'File Create Transaction';
  } else if (transaction instanceof FileUpdateTransaction) {
    type = 'File Update Transaction';
  } else if (transaction instanceof FileDeleteTransaction) {
    type = 'File Delete Transaction';
  } else if (transaction instanceof ScheduleCreateTransaction) {
    type = 'Schedule Create Transaction';
  } else if (transaction instanceof ScheduleSignTransaction) {
    type = 'Schedule Sign Transaction';
  } else if (transaction instanceof FreezeTransaction) {
    type = 'Freeze Transaction';
  } else {
    type = 'Unknown Transaction Type';
  }

  if (removeTransaction) {
    type = type.replace(' Transaction', '');
  }

  if (short) {
    type = type.replace(/\s+/g, '');
  }

  return type;
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
