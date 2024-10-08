import {
  AccountAllowanceApproveTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountId,
  AccountUpdateTransaction,
  FileAppendTransaction,
  FileCreateTransaction,
  FileId,
  FileUpdateTransaction,
  FreezeTransaction,
  FreezeType,
  Hbar,
  Key,
  KeyList,
  Timestamp,
  Transaction,
  TransactionId,
  Transfer,
  TransferTransaction,
} from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';
import type { IAccountInfoParsed } from '@main/shared/interfaces';

import { isAccountId, isFileId } from '../validator';
import { compareKeys } from '.';

type TransactionCommon = {
  payerId: string;
  validStart: Date;
  maxTransactionFee: Hbar;
  transactionMemo: string;
};

/* Crafts transaction id by account id and valid start */
export const createTransactionId = (
  accountId: AccountId | string,
  validStart: Timestamp | string | Date | null,
) => {
  if (typeof accountId === 'string') {
    accountId = AccountId.fromString(accountId);
  }

  if (!validStart) {
    validStart = Timestamp.generate();
  }

  if (typeof validStart === 'string' || validStart instanceof Date) {
    const date = validStart instanceof Date ? validStart : new Date(validStart);
    const expirationDate = new Date(date.getTime() + 1000 * 60 * 3);
    validStart = Timestamp.fromDate(expirationDate < new Date() ? new Date() : date);
  }

  return TransactionId.withValidStart(accountId, validStart);
};

const setTransactionCommon = (transaction: Transaction, data: TransactionCommon) => {
  if (isAccountId(data.payerId)) {
    transaction.setTransactionId(createTransactionId(data.payerId, data.validStart));
  }

  transaction.setTransactionValidDuration(180);
  transaction.setMaxTransactionFee(data.maxTransactionFee);

  if (data.transactionMemo.length > 0 && data.transactionMemo.length <= MEMO_MAX_LENGTH) {
    transaction.setTransactionMemo(data.transactionMemo);
  }
};

/* Account Create Transaction */
export const createAccountTransaction = (
  data: TransactionCommon & {
    receiverSignatureRequired: boolean;
    declineStakingReward: boolean;
    maxAutomaticTokenAssociations: number;
    accountMemo: string;
    stakeType: 'Account' | 'Node' | 'None';
    stakedAccountId: string;
    stakedNodeId: number | null;
    initialBalance: Hbar | null;
    ownerKey: Key | null;
  },
) => {
  const transaction = new AccountCreateTransaction()
    .setReceiverSignatureRequired(data.receiverSignatureRequired)
    .setDeclineStakingReward(data.declineStakingReward)
    .setInitialBalance(data.initialBalance || new Hbar(0))
    .setMaxAutomaticTokenAssociations(data.maxAutomaticTokenAssociations)
    .setAccountMemo(data.accountMemo);

  setTransactionCommon(transaction, data);

  if (data.ownerKey) {
    transaction.setKey(data.ownerKey);
  }

  if (data.stakeType === 'Account' && isAccountId(data.stakedAccountId)) {
    transaction.setStakedAccountId(AccountId.fromString(data.stakedAccountId));
  } else if (data.stakeType === 'Node' && data.stakedNodeId !== null) {
    transaction.setStakedNodeId(Number(data.stakedNodeId));
  }

  return transaction;
};

/* Approve Allowance Transaction */
export const createApproveAllowanceTransaction = (
  data: TransactionCommon & {
    ownerAccountId: string;
    spenderAccountId: string;
    amount: Hbar;
  },
) => {
  const transaction = new AccountAllowanceApproveTransaction();
  setTransactionCommon(transaction, data);

  if (isAccountId(data.ownerAccountId) && isAccountId(data.spenderAccountId)) {
    transaction.approveHbarAllowance(data.ownerAccountId, data.spenderAccountId, data.amount);
  }

  return transaction;
};

/* Accound Delete Transaction */
export const createAccountDeleteTransaction = (
  data: TransactionCommon & {
    accountId: string;
    transferAccountId: string;
  },
) => {
  const transaction = new AccountDeleteTransaction();
  setTransactionCommon(transaction, data);

  if (isAccountId(data.accountId)) {
    transaction.setAccountId(data.accountId);
  }

  if (isAccountId(data.transferAccountId)) {
    transaction.setTransferAccountId(data.transferAccountId);
  }

  return transaction;
};

/* Accound Update Transaction */
export const createAccountUpdateTransaction = (
  data: TransactionCommon & {
    accountId: string;
    receiverSignatureRequired: boolean;
    declineStakingReward: boolean;
    maxAutomaticTokenAssociations: number;
    accountMemo: string;
    ownerKey: Key | null;
    stakeType: 'Account' | 'Node' | 'None';
    stakedAccountId: string;
    stakedNodeId: number | null;
  },
  oldData: IAccountInfoParsed | null,
) => {
  const transaction = new AccountUpdateTransaction();
  setTransactionCommon(transaction, data);

  isAccountId(data.accountId) && transaction.setAccountId(data.accountId);

  if (oldData?.receiverSignatureRequired !== data.receiverSignatureRequired) {
    transaction.setReceiverSignatureRequired(data.receiverSignatureRequired);
  }

  if (oldData?.declineReward !== data.declineStakingReward) {
    transaction.setDeclineStakingReward(data.declineStakingReward);
  }

  if (oldData?.maxAutomaticTokenAssociations !== data.maxAutomaticTokenAssociations) {
    transaction.setMaxAutomaticTokenAssociations(Number(data.maxAutomaticTokenAssociations));
  }

  if (oldData?.memo !== data.accountMemo) {
    transaction.setAccountMemo(data.accountMemo || '');
  }

  if (data.ownerKey && oldData?.key) {
    !compareKeys(data.ownerKey, oldData?.key) && transaction.setKey(data.ownerKey);
  } else if (data.ownerKey) {
    transaction.setKey(data.ownerKey);
  }

  if (data.stakeType === 'None') {
    oldData?.stakedAccountId && transaction.clearStakedAccountId();
    oldData?.stakedNodeId !== null && transaction.clearStakedNodeId();
  } else if (data.stakeType === 'Account') {
    if (!isAccountId(data.stakedAccountId) || data.stakedAccountId === '0.0.0') {
      transaction.clearStakedAccountId();
    } else if (
      isAccountId(data.stakedAccountId) &&
      oldData?.stakedAccountId?.toString() !== data.stakedAccountId
    ) {
      transaction.setStakedAccountId(data.stakedAccountId);
    }
  } else if (data.stakeType === 'Node') {
    if (data.stakedNodeId === null) {
      transaction.clearStakedNodeId();
    } else if (oldData?.stakedNodeId !== data.stakedNodeId) {
      transaction.setStakedNodeId(data.stakedNodeId);
    }
  }

  return transaction;
};

/* File Append Transaction */
export const createFileAppendTransaction = (
  data: TransactionCommon & {
    fileId: string;
    chunkSize: number;
    maxChunks: number;
    contents: Uint8Array | null;
  },
) => {
  const transaction = new FileAppendTransaction().setMaxChunks(data.maxChunks);
  setTransactionCommon(transaction, data);

  if (isAccountId(data.fileId)) {
    transaction.setFileId(data.fileId);
  }

  if (data.contents) {
    transaction.setContents(data.contents);
  }

  if (typeof data.chunkSize === 'number') {
    transaction.setChunkSize(data.chunkSize);
  }

  return transaction;
};

const setFileInfo = (
  transaction: FileCreateTransaction | FileUpdateTransaction,
  data: {
    ownerKey: Key | null;
    fileMemo: string;
    expirationTime: Date | null;
    contents: Uint8Array | string | null;
  },
) => {
  if (data.fileMemo.length > 0 && data.fileMemo.length <= MEMO_MAX_LENGTH) {
    transaction.setFileMemo(data.fileMemo);
  }

  if (data.ownerKey) {
    transaction.setKeys(
      data.ownerKey instanceof KeyList ? data.ownerKey : new KeyList([data.ownerKey]),
    );
  }

  if (data.expirationTime) {
    transaction.setExpirationTime(Timestamp.fromDate(data.expirationTime));
  }

  if (data.contents && data.contents.length > 0) {
    transaction.setContents(data.contents);
  }
};

/* File Create Transaction */
export const createFileCreateTransaction = (
  data: TransactionCommon & {
    ownerKey: Key | null;
    fileMemo: string;
    expirationTime: Date | null;
    contents: Uint8Array | string | null;
  },
) => {
  const transaction = new FileCreateTransaction();
  setTransactionCommon(transaction, data);
  setFileInfo(transaction, data);
  return transaction;
};

/* File Update Transaction */
export const createFileUpdateTransaction = (
  data: TransactionCommon & {
    fileId: string;
    ownerKey: Key | null;
    fileMemo: string;
    expirationTime: Date | null;
    contents: Uint8Array | string | null;
  },
) => {
  const transaction = new FileUpdateTransaction();
  setTransactionCommon(transaction, data);
  setFileInfo(transaction, data);

  if (isAccountId(data.fileId)) {
    transaction.setFileId(data.fileId);
  }

  return transaction;
};

/* Freeze Transaction */
export const createFreezeTransaction = (
  data: TransactionCommon & {
    freezeType: number;
    startTimestamp: Date;
    fileId: string;
    fileHash: string;
  },
) => {
  const transaction = new FreezeTransaction();
  setTransactionCommon(transaction, data);

  if (data.freezeType <= 0 || data.freezeType > 6) return transaction;

  const type = FreezeType._fromCode(Number(data.freezeType));
  transaction.setFreezeType(type);

  const setProps = (
    _startTimestamp: boolean = false,
    _fileId: boolean = false,
    _fileHash: boolean = false,
  ) => {
    if (_startTimestamp) {
      transaction.setStartTimestamp(Timestamp.fromDate(data.startTimestamp));
    }

    if (_fileId && isFileId(data.fileId) && data.fileId !== '0.0.0') {
      transaction.setFileId(FileId.fromString(data.fileId));
    }

    if (_fileHash && data.fileHash.trim().length > 0) {
      transaction.setFileHash(data.fileHash);
    }
  };

  switch (type) {
    case FreezeType.FreezeOnly:
      setProps(true);
      break;
    case FreezeType.PrepareUpgrade:
      setProps(false, true, true);
      break;
    case FreezeType.FreezeUpgrade:
      setProps(true, true, true);
      break;
  }

  return transaction;
};

/* Transfer Hbar */
export const createTransferHbarTransaction = (
  data: TransactionCommon & {
    transfers: Transfer[];
  },
) => {
  const transaction = new TransferTransaction();
  setTransactionCommon(transaction, data);

  data.transfers.forEach(transfer => {
    transfer.isApproved
      ? transaction.addApprovedHbarTransfer(transfer.accountId.toString(), transfer.amount)
      : transaction.addHbarTransfer(transfer.accountId.toString(), transfer.amount);
  });

  return transaction;
};
