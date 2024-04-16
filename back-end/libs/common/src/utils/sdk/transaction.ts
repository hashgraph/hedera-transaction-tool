import { Transaction } from '@hashgraph/sdk';

import { TransactionType } from '@app/common/database/entities';

export const isExpired = (transaction: Transaction) => {
  if (!transaction.transactionId?.validStart) {
    return true;
  }

  const validStart = transaction.transactionId.validStart.toDate();
  const duration = transaction.transactionValidDuration;

  return new Date().getTime() >= validStart.getTime() + duration * 1_000;
};

export const getTransactionTypeEnumValue = (transaction: Transaction): TransactionType => {
  const sdkType = transaction.constructor.name
    .slice(transaction.constructor.name.startsWith('_') ? 1 : 0)
    .split(/(?=[A-Z])/)
    .join(' ')
    .replace('Transaction', '')
    .trim()
    .toLocaleUpperCase();

  switch (sdkType) {
    case TransactionType.ACCOUNT_CREATE:
      return TransactionType.ACCOUNT_CREATE;
    case TransactionType.ACCOUNT_UPDATE:
      return TransactionType.ACCOUNT_UPDATE;
    case TransactionType.ACCOUNT_DELETE:
      return TransactionType.ACCOUNT_DELETE;
    case TransactionType.FILE_CREATE:
      return TransactionType.FILE_CREATE;
    case TransactionType.FILE_APPEND:
      return TransactionType.FILE_APPEND;
    case TransactionType.FILE_UPDATE:
      return TransactionType.FILE_UPDATE;
    case TransactionType.FILE_DELETE:
      return TransactionType.FILE_DELETE;
    case TransactionType.FREEZE:
      return TransactionType.FREEZE;
    case TransactionType.SYSTEM_DELETE:
      return TransactionType.SYSTEM_DELETE;
    case TransactionType.SYSTEM_UNDELETE:
      return TransactionType.SYSTEM_UNDELETE;
    case TransactionType.TRANSFER:
      return TransactionType.TRANSFER;
    default:
      throw new Error(`Unsupported transaction type: ${sdkType}`);
  }
};
