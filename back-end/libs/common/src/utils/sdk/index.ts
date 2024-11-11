import { AccountId, FileId, Hbar, HbarUnit, TransactionId } from '@hashgraph/sdk';

export * from './transaction';
export * from './client';
export * from './key';
export * from './account';
export * from './node';

export const parseHbar = (hbar: string | number | null, unit: HbarUnit): Hbar | null => {
  if (!hbar) {
    return null;
  }

  hbar = hbar.toString();

  if (hbar.startsWith('-')) {
    return null;
  }

  return Hbar.from(hbar, unit);
};

export const isAccountId = (accountId: string) => {
  try {
    AccountId.fromString(accountId);
    return true;
  } catch (error) {
    return false;
  }
};

export const isFileId = (accountId: string) => {
  try {
    FileId.fromString(accountId);
    return true;
  } catch (error) {
    return false;
  }
};

export const isTransactionId = (transactionId: string) => {
  try {
    TransactionId.fromString(transactionId);
    return true;
  } catch (error) {
    return false;
  }
};
