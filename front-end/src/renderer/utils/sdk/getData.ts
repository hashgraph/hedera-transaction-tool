import type { Transaction } from '@hashgraph/sdk';

import {
  AccountAllowanceApproveTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountUpdateTransaction,
  FileAppendTransaction,
  FileCreateTransaction,
  FileUpdateTransaction,
  FreezeTransaction,
  Hbar,
  KeyList,
  TransferTransaction,
} from '@hashgraph/sdk';

import type {
  AccountCreateData,
  AccountData,
  AccountDeleteData,
  AccountUpdateData,
  ApproveHbarAllowanceData,
  FileAppendData,
  FileCreateData,
  FileData,
  FileUpdateData,
  FreezeData,
  TransactionCommonData,
  TransferHbarData,
} from './createTransactions';
import { getMaximumExpirationTime, getMinimumExpirationTime } from '.';
import { uint8ToHex } from '..';

export const getTransactionCommonData = (transaction: Transaction): TransactionCommonData => {
  const transactionId = transaction.transactionId;
  const payerId = transactionId?.accountId?.toString()?.trim();
  const validStart = transactionId?.validStart?.toDate();
  const maxTransactionFee = transaction.maxTransactionFee;
  const transactionMemo = transaction.transactionMemo.trim();

  return {
    payerId: payerId || '',
    validStart: validStart || new Date(),
    maxTransactionFee: maxTransactionFee || new Hbar(2),
    transactionMemo: transactionMemo || '',
  };
};

type AssertType = <T extends Transaction>(
  transaction: Transaction,
  type: new (...args: any[]) => T,
) => asserts transaction is T;
export const assertTransactionType: AssertType = (transaction, type) => {
  if (!(transaction instanceof type)) {
    throw new Error('Invalid transaction type.');
  }
};

const getAccountData = (transaction: Transaction): AccountData => {
  if (
    !(transaction instanceof AccountCreateTransaction) &&
    !(transaction instanceof AccountUpdateTransaction)
  ) {
    throw new Error('Invalid transaction type.');
  }
  return {
    receiverSignatureRequired: transaction.receiverSignatureRequired || false,
    declineStakingReward: transaction.declineStakingRewards || false,
    maxAutomaticTokenAssociations: transaction.maxAutomaticTokenAssociations?.toNumber() || 0,
    stakeType: transaction.stakedAccountId ? 'Account' : transaction.stakedNodeId ? 'Node' : 'None',
    stakedAccountId: transaction.stakedAccountId?.toString() || '',
    stakedNodeId: transaction.stakedNodeId?.toNumber() || null,
    accountMemo: transaction.accountMemo || '',
    ownerKey: transaction.key || null,
  };
};

export const getAccountCreateData = (transaction: Transaction): AccountCreateData => {
  assertTransactionType(transaction, AccountCreateTransaction);
  return {
    initialBalance: transaction.initialBalance || new Hbar(0),
    ...getAccountData(transaction),
  };
};

export const getAccountUpdateData = (transaction: Transaction): AccountUpdateData => {
  assertTransactionType(transaction, AccountUpdateTransaction);
  return {
    accountId: transaction.accountId?.toString() || '',
    ...getAccountData(transaction),
  };
};

export const getApproveHbarAllowanceTransactionData = (
  transaction: Transaction,
): ApproveHbarAllowanceData => {
  assertTransactionType(transaction, AccountAllowanceApproveTransaction);
  if (transaction.hbarApprovals.length > 0) {
    const hbarApproval = transaction.hbarApprovals[0];
    return {
      ownerAccountId: hbarApproval.ownerAccountId?.toString() || '',
      spenderAccountId: hbarApproval.spenderAccountId?.toString() || '',
      amount: hbarApproval.amount || new Hbar(0),
    };
  }
  return {
    ownerAccountId: '',
    spenderAccountId: '',
    amount: new Hbar(0),
  };
};

export const getAccountDeleteData = (transaction: Transaction): AccountDeleteData => {
  assertTransactionType(transaction, AccountDeleteTransaction);
  return {
    accountId: transaction.accountId?.toString() || '',
    transferAccountId: transaction.transferAccountId?.toString() || '',
  };
};

export const getFileInfoTransactionData = (transaction: Transaction): FileData => {
  if (
    !(transaction instanceof FileCreateTransaction) &&
    !(transaction instanceof FileUpdateTransaction)
  ) {
    throw new Error('Invalid transaction type.');
  }
  let expirationTime: Date | null = null;

  if (transaction.expirationTime) {
    const expirationDate = transaction.expirationTime.toDate();
    if (
      expirationDate > getMinimumExpirationTime() &&
      expirationDate < getMaximumExpirationTime()
    ) {
      expirationTime = expirationDate;
    }
  }
  return {
    ownerKey: transaction.keys ? new KeyList(transaction.keys) : null,
    contents: transaction.contents ? new TextDecoder().decode(transaction.contents) : '',
    fileMemo: transaction.fileMemo || '',
    expirationTime,
  };
};

export const getFileCreateTransactionData = (transaction: Transaction): FileCreateData => {
  return getFileInfoTransactionData(transaction);
};

export const getFileUpdateTransactionData = (transaction: Transaction): FileUpdateData => {
  assertTransactionType(transaction, FileUpdateTransaction);
  return {
    fileId: transaction.fileId?.toString() || '',
    ...getFileInfoTransactionData(transaction),
  };
};

export const getFileAppendTransactionData = (transaction: Transaction): FileAppendData => {
  assertTransactionType(transaction, FileAppendTransaction);
  return {
    fileId: transaction.fileId?.toString() || '',
    chunkSize: transaction.chunkSize || 0,
    maxChunks: transaction.maxChunks || 9999999999999,
    contents: transaction.contents ? new TextDecoder().decode(transaction.contents) : '',
  };
};

export const getFreezeData = (transaction: Transaction): FreezeData => {
  assertTransactionType(transaction, FreezeTransaction);
  return {
    freezeType: transaction.freezeType?._code || -1,
    startTimestamp: transaction.startTimestamp?.toDate() || new Date(),
    fileId: transaction.fileId?.toString() || '',
    fileHash: transaction.fileHash ? uint8ToHex(transaction.fileHash) : '',
  };
};

export const getTransferHbarData = (transaction: Transaction): TransferHbarData => {
  assertTransactionType(transaction, TransferTransaction);
  return {
    transfers: transaction.hbarTransfersList,
  };
};
