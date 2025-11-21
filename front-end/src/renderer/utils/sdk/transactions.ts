import {
  AccountAllowanceApproveTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountUpdateTransaction,
  FileAppendTransaction,
  FileContentsQuery,
  FileCreateTransaction,
  FileDeleteTransaction,
  FileUpdateTransaction,
  FreezeTransaction,
  FreezeType,
  NodeCreateTransaction,
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
  Transaction,
  TransferTransaction,
} from '@hashgraph/sdk';
import { getDateStringExtended } from '..';

export const getTransactionDate = (transaction: Transaction) =>
  transaction.transactionId?.validStart?.toDate().toDateString() || null;

export const getTransactionDateExtended = (transaction: Transaction) => {
  const validStart = transaction.transactionId?.validStart;
  if (!validStart) return null;

  return getDateStringExtended(validStart.toDate());
};

export const getTransactionPayerId = (transaction: Transaction) =>
  transaction.transactionId?.accountId?.toString() || null;

export const getTransactionValidStart = (transaction: Transaction) =>
  transaction.transactionId?.validStart?.toDate() || null;

export const formatTransactionType = (
  type: string,
  short = false,
  removeTransaction = false,
): string => {
  let result = type
  if (removeTransaction) {
    // Remove ' Transaction' only if it appears at the end
    result = type.replace(/ Transaction$/, '');
  }
  if (short) {
    // Remove all whitespace characters
    result = type.replace(/\s+/g, '');
  }
  return result;
};

export const getTransactionType = (
  transaction: Transaction | Uint8Array,
  short = false,
  removeTransaction = false,
) => {
  if (transaction instanceof Uint8Array) {
    transaction = Transaction.fromBytes(transaction);
  }

  let transactionType = 'Unknown Transaction Type';

  if (transaction instanceof AccountCreateTransaction) {
    transactionType = 'Account Create Transaction';
  } else if (transaction instanceof AccountUpdateTransaction) {
    transactionType = 'Account Update Transaction';
  } else if (transaction instanceof AccountDeleteTransaction) {
    transactionType = 'Account Delete Transaction';
  } else if (transaction instanceof TransferTransaction) {
    transactionType = 'Transfer Transaction';
  } else if (transaction instanceof AccountAllowanceApproveTransaction) {
    transactionType = 'Account Allowance Approve Transaction';
  } else if (transaction instanceof FileCreateTransaction) {
    transactionType = 'File Create Transaction';
  } else if (transaction instanceof FileUpdateTransaction) {
    transactionType = 'File Update Transaction';
  } else if (transaction instanceof FileAppendTransaction) {
    transactionType = 'File Append Transaction';
  } else if (transaction instanceof FileDeleteTransaction) {
    transactionType = 'File Delete Transaction';
  } else if (transaction instanceof FileContentsQuery) {
    transactionType = 'Read File Query';
  } else if (transaction instanceof FreezeTransaction) {
    transactionType = 'Freeze Transaction';
  } else if (transaction instanceof NodeCreateTransaction) {
    transactionType = 'Node Create Transaction';
  } else if (transaction instanceof NodeUpdateTransaction) {
    transactionType = 'Node Update Transaction';
  } else if (transaction instanceof NodeDeleteTransaction) {
    transactionType = 'Node Delete Transaction';
  } else if (transaction instanceof SystemDeleteTransaction) {
    transactionType = 'System Delete Transaction';
  } else if (transaction instanceof SystemUndeleteTransaction) {
    transactionType = 'System Undelete Transaction';
  }

  return formatTransactionType(transactionType, short, removeTransaction);
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
