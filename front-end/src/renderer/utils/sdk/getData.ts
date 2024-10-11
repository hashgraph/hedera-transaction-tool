import type { Transaction } from '@hashgraph/sdk';

import { AccountCreateTransaction, Hbar } from '@hashgraph/sdk';

import type { AccountCreateData, TransactionCommonData } from './createTransactions';

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

export const getAccountCreateData = (transaction: Transaction): AccountCreateData => {
  if (!(transaction instanceof AccountCreateTransaction)) {
    throw new Error('Invalid transaction type.');
  }

  return {
    receiverSignatureRequired: transaction.receiverSignatureRequired,
    maxAutomaticTokenAssociations: transaction.maxAutomaticTokenAssociations?.toNumber() || 0,
    initialBalance: transaction.initialBalance || new Hbar(0),
    stakeType: transaction.stakedAccountId ? 'Account' : transaction.stakedNodeId ? 'Node' : 'None',
    stakedAccountId: transaction.stakedAccountId?.toString() || '',
    stakedNodeId: transaction.stakedNodeId?.toNumber() || null,
    declineStakingReward: transaction.declineStakingRewards,
    accountMemo: transaction.accountMemo || '',
    ownerKey: transaction.key || null,
  };
};
