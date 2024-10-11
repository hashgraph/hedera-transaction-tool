import type { Transaction } from '@hashgraph/sdk';

import { AccountCreateTransaction, AccountUpdateTransaction, Hbar } from '@hashgraph/sdk';

import type {
  AccountCreateData,
  AccountData,
  AccountUpdateData,
  TransactionCommonData,
} from './createTransactions';

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
const assertTransactionType: AssertType = (transaction, type) => {
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
