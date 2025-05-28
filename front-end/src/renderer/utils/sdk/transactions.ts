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
) => {
  if (transaction instanceof Uint8Array) {
    transaction = Transaction.fromBytes(transaction);
  }

  let transactionType = 'Unknown Transaction Type';

  if (transaction instanceof AccountCreateTransaction) {
    transactionType = "Account Create Transaction";
  } else if (transaction instanceof AccountUpdateTransaction) {
    transactionType = "Account Update Transaction";
  } else if (transaction instanceof AccountDeleteTransaction) {
    transactionType = "Account Delete Transaction";
  } else if (transaction instanceof TransferTransaction) {
    transactionType = "Transfer Transaction";
  } else if (transaction instanceof AccountAllowanceApproveTransaction) {
    transactionType = "Account Allowance Approve Transaction";
  } else if (transaction instanceof FileCreateTransaction) {
    transactionType = "File Create Transaction";
  } else if (transaction instanceof FileUpdateTransaction) {
    transactionType = "File Update Transaction";
  } else if (transaction instanceof FileAppendTransaction) {
    transactionType = "File Append Transaction";
  } else if (transaction instanceof FileDeleteTransaction) {
    transactionType = "File Delete Transaction";
  } else if (transaction instanceof FileContentsQuery) {
    transactionType = "Read File Query";
  } else if (transaction instanceof FreezeTransaction) {
    transactionType = "Freeze Transaction";
  } else if (transaction instanceof NodeCreateTransaction) {
    transactionType = "Node Create Transaction";
  } else if (transaction instanceof NodeUpdateTransaction) {
    transactionType = "Node Update Transaction";
  } else if (transaction instanceof NodeDeleteTransaction) {
    transactionType = "Node Delete Transaction";
  } else if (transaction instanceof SystemDeleteTransaction) {
    transactionType = "System Delete Transaction";
  } else if (transaction instanceof SystemUndeleteTransaction) {
    transactionType = "System Undelete Transaction";
    // } else if (transaction instanceof ContractCallTransaction) {
    //   transactionType = 'ContractCallTransaction';
    // } else if (transaction instanceof ContractCreateTransaction) {
    //   transactionType = 'ContractCreateTransaction';
    // } else if (transaction instanceof ContractDeleteTransaction) {
    //   transactionType = 'ContractDeleteTransaction';
    // } else if (transaction instanceof ContractUpdateTransaction) {
    //   transactionType = 'ContractUpdateTransaction';
    // } else if (transaction instanceof ScheduleCreateTransaction) {
    //   transactionType = 'ScheduleCreateTransaction';
    // } else if (transaction instanceof ScheduleDeleteTransaction) {
    //   transactionType = 'ScheduleDeleteTransaction';
    // } else if (transaction instanceof ScheduleSignTransaction) {
    //   transactionType = 'ScheduleSignTransaction';
    // } else if (transaction instanceof TokenAssociateTransaction) {
    //   transactionType = 'TokenAssociateTransaction';
    // } else if (transaction instanceof TokenBurnTransaction) {
    //   transactionType = 'TokenBurnTransaction';
    // } else if (transaction instanceof TokenCreateTransaction) {
    //   transactionType = 'TokenCreateTransaction';
    // } else if (transaction instanceof TokenDeleteTransaction) {
    //   transactionType = 'TokenDeleteTransaction';
    // } else if (transaction instanceof TokenFeeScheduleUpdateTransaction) {
    //   transactionType = 'TokenFeeScheduleUpdateTransaction';
    // } else if (transaction instanceof TokenFreezeTransaction) {
    //   transactionType = 'TokenFreezeTransaction';
    // } else if (transaction instanceof TokenGrantKycTransaction) {
    //   transactionType = 'TokenGrantKycTransaction';
    // } else if (transaction instanceof TokenMintTransaction) {
    //   transactionType = 'TokenMintTransaction';
    // } else if (transaction instanceof TokenPauseTransaction) {
    //   transactionType = 'TokenPauseTransaction';
    // } else if (transaction instanceof TokenRevokeKycTransaction) {
    //   transactionType = 'TokenRevokeKycTransaction';
    // } else if (transaction instanceof TokenUnfreezeTransaction) {
    //   transactionType = 'TokenUnfreezeTransaction';
    // } else if (transaction instanceof TokenUnpauseTransaction) {
    //   transactionType = 'TokenUnpauseTransaction';
    // } else if (transaction instanceof TokenUpdateTransaction) {
    //   transactionType = 'TokenUpdateTransaction';
    // } else if (transaction instanceof TopicCreateTransaction) {
    //   transactionType = 'TopicCreateTransaction';
    // } else if (transaction instanceof TopicDeleteTransaction) {
    //   transactionType = 'TopicDeleteTransaction';
    // } else if (transaction instanceof TopicMessageSubmitTransaction) {
    //   transactionType = 'TopicMessageSubmitTransaction';
    // } else if (transaction instanceof TopicUpdateTransaction) {
    //   transactionType = 'TopicUpdateTransaction';
  }

  if (removeTransaction) {
    // Remove ' Transaction' only if it appears at the end
    transactionType = transactionType.replace(/ Transaction$/, '');
  }
  if (short) {
    // Remove all whitespace characters
    transactionType = transactionType.replace(/\s+/g, '');
  }
  return transactionType;
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
