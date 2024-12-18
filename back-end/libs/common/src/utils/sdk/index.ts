import { AccountId, FileId, Hbar, HbarUnit, TransactionId } from '@hashgraph/sdk';

export * from './transaction';
export * from './client';
export * from './key';
export * from './account';
export * from './node';

export const parseHbar = (hbar: number | null, unit: HbarUnit): Hbar | null => {
  hbar = parseInt(hbar?.toString());
  if (!hbar) {
    return null;
  }

  if (hbar < 0) {
    return null;
  }

  return Hbar.from(hbar, unit);
};

export const isAccountId = (accountId: string) => {
  try {
    AccountId.fromString(accountId);
    return true;
  } catch {
    return false;
  }
};

export const isFileId = (accountId: string) => {
  try {
    FileId.fromString(accountId);
    return true;
  } catch {
    return false;
  }
};

export const isTransactionId = (transactionId: string) => {
  try {
    TransactionId.fromString(transactionId);
    return true;
  } catch {
    return false;
  }
};
