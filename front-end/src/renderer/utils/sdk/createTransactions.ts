import type { IAccountInfoParsed, INodeInfoParsed } from '@main/shared/interfaces';

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
  NodeCreateTransaction,
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  ServiceEndpoint,
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
  Timestamp,
  Transaction,
  TransactionId,
  Transfer,
  TransferTransaction,
} from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';

import { isAccountId, isContractId, isFileId } from '../validator';
import { compareKeys } from '.';
import { hexToUint8Array, stringToHex } from '..';

export type TransactionData = TransactionCommonData & TransactionSpecificData;

export type TransactionCommonData = {
  payerId: string;
  validStart: Date;
  maxTransactionFee: Hbar;
  transactionMemo: string;
};

export type TransactionSpecificData =
  | AccountCreateData
  | AccountUpdateData
  | AccountDeleteData
  | ApproveHbarAllowanceData
  | FileCreateData
  | FileUpdateData
  | FileAppendData
  | FreezeData
  | TransferHbarData;

export type AccountData = {
  receiverSignatureRequired: boolean;
  declineStakingReward: boolean;
  maxAutomaticTokenAssociations: number;
  accountMemo: string;
  stakeType: 'Account' | 'Node' | 'None';
  stakedAccountId: string;
  stakedNodeId: number | null;
  ownerKey: Key | null;
};

export type AccountCreateData = AccountData & {
  initialBalance: Hbar | null;
};

export type AccountDeleteData = {
  accountId: string;
  transferAccountId: string;
};

export type AccountUpdateData = AccountData & {
  accountId: string;
};

export type ApproveHbarAllowanceData = {
  ownerAccountId: string;
  spenderAccountId: string;
  amount: Hbar;
};

export type FileData = {
  ownerKey: Key | null;
  fileMemo: string;
  expirationTime: Date | null;
  contents: Uint8Array | string | null;
};

export type FileCreateData = FileData;

export type FileUpdateData = FileData & {
  fileId: string;
};

export type FileAppendData = {
  fileId: string;
  chunkSize: number;
  maxChunks: number;
  contents: Uint8Array | string | null;
};

export type FreezeData = {
  freezeType: number;
  startTimestamp: Date;
  fileId: string;
  fileHash: string;
};

export type TransferHbarData = {
  transfers: Transfer[];
};

export interface ComponentServiceEndpoint {
  ipAddressV4: string | null;
  port: string;
  domainName: string | null;
}

export type NodeData = {
  nodeAccountId: string;
  description: string;
  gossipEndpoints: ComponentServiceEndpoint[];
  serviceEndpoints: ComponentServiceEndpoint[];
  gossipCaCertificate: string;
  certificateHash: string;
  adminKey: Key | null;
};

export type NodeUpdateData = NodeData & {
  nodeId: string;
};

export type NodeDeleteData = {
  nodeId: string;
};

export type SystemData = {
  fileId: string;
  contractId: string;
};

export type SystemDeleteData = SystemData & {
  expirationTime: Date | null;
};

export type SystemUndeleteData = SystemData;

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

const setTransactionCommonData = (transaction: Transaction, data: TransactionCommonData) => {
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
export const createAccountCreateTransaction = (
  data: TransactionCommonData & AccountCreateData,
): AccountCreateTransaction => {
  const transaction = new AccountCreateTransaction()
    .setReceiverSignatureRequired(data.receiverSignatureRequired)
    .setDeclineStakingReward(data.declineStakingReward)
    .setInitialBalance(data.initialBalance || new Hbar(0))
    .setMaxAutomaticTokenAssociations(data.maxAutomaticTokenAssociations)
    .setAccountMemo(data.accountMemo);

  setTransactionCommonData(transaction, data);

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
export const createApproveHbarAllowanceTransaction = (
  data: TransactionCommonData & ApproveHbarAllowanceData,
): AccountAllowanceApproveTransaction => {
  const transaction = new AccountAllowanceApproveTransaction();
  setTransactionCommonData(transaction, data);

  if (isAccountId(data.ownerAccountId) && isAccountId(data.spenderAccountId)) {
    transaction.approveHbarAllowance(data.ownerAccountId, data.spenderAccountId, data.amount);
  }

  return transaction;
};

/* Accound Delete Transaction */
export const createAccountDeleteTransaction = (
  data: TransactionCommonData & AccountDeleteData,
): AccountDeleteTransaction => {
  const transaction = new AccountDeleteTransaction();
  setTransactionCommonData(transaction, data);

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
  data: TransactionCommonData & AccountUpdateData,
  oldData: IAccountInfoParsed | null,
): AccountUpdateTransaction => {
  const transaction = new AccountUpdateTransaction();
  setTransactionCommonData(transaction, data);

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
  data: TransactionCommonData & FileAppendData,
): FileAppendTransaction => {
  const transaction = new FileAppendTransaction().setMaxChunks(data.maxChunks);
  setTransactionCommonData(transaction, data);

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
  data: FileData,
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

export const createFileCreateDataOnlyTransaction = (data: FileData) => {
  const transaction = new FileCreateTransaction();
  setFileInfo(transaction, data);
  return transaction;
};

/* File Create Transaction */
export const createFileCreateTransaction = (
  data: TransactionCommonData & FileData,
): FileCreateTransaction => {
  const transaction = new FileCreateTransaction();
  setTransactionCommonData(transaction, data);
  setFileInfo(transaction, data);
  return transaction;
};

/* File Update Transaction */
export const createFileUpdateTransaction = (
  data: TransactionCommonData & FileUpdateData,
): FileUpdateTransaction => {
  const transaction = new FileUpdateTransaction();
  setTransactionCommonData(transaction, data);
  setFileInfo(transaction, data);

  if (isAccountId(data.fileId)) {
    transaction.setFileId(data.fileId);
  }

  return transaction;
};

/* Freeze Transaction */
export const createFreezeTransaction = (
  data: TransactionCommonData & FreezeData,
): FreezeTransaction => {
  const transaction = new FreezeTransaction();
  setTransactionCommonData(transaction, data);

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

    if (_fileHash && data.fileHash.length > 0) {
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
  data: TransactionCommonData & TransferHbarData,
): TransferTransaction => {
  const transaction = new TransferTransaction();
  setTransactionCommonData(transaction, data);

  data.transfers.forEach(transfer => {
    transfer.isApproved
      ? transaction.addApprovedHbarTransfer(transfer.accountId.toString(), transfer.amount)
      : transaction.addHbarTransfer(transfer.accountId.toString(), transfer.amount);
  });

  return transaction;
};

export const getServiceEndpoints = (data: ComponentServiceEndpoint[]) => {
  const endpoints = new Array<ServiceEndpoint>();

  for (const serviceEndpoint of data) {
    const ipAddressV4 = serviceEndpoint.ipAddressV4?.trim();
    const port = Number.parseInt(serviceEndpoint.port?.trim());
    const domainName = serviceEndpoint.domainName?.trim();

    if (ipAddressV4 || domainName) {
      const serviceEndpoint = new ServiceEndpoint();

      if (ipAddressV4) {
        serviceEndpoint.setIpAddressV4(hexToUint8Array(stringToHex(ipAddressV4)));
      } else if (domainName) {
        serviceEndpoint.setDomainName(domainName);
      }

      if (!isNaN(port)) {
        serviceEndpoint.setPort(port);
      }

      endpoints.push(serviceEndpoint);
    }
  }

  return endpoints;
};

const setNodeData = (
  transaction: NodeCreateTransaction | NodeUpdateTransaction,
  data: NodeData,
  oldData?: INodeInfoParsed | null,
) => {
  const txGossipEndpoints = getServiceEndpoints(data.gossipEndpoints);
  const txServiceEndpoints = getServiceEndpoints(data.serviceEndpoints);

  if (oldData?.description !== data.description) {
    transaction.setDescription(data.description);
  }

  if (data.certificateHash) {
    const uint8array = hexToUint8Array(data.certificateHash);
    if (uint8array.length > 0) {
      transaction.setCertificateHash(hexToUint8Array(data.certificateHash));
    }
  }

  if (
    isAccountId(data.nodeAccountId) &&
    data.nodeAccountId !== oldData?.node_account_id?.toString()
  ) {
    transaction.setAccountId(data.nodeAccountId);
  }

  if (txGossipEndpoints.length > 0) {
    transaction.setGossipEndpoints(txGossipEndpoints);
  }

  if (txServiceEndpoints.length > 0) {
    transaction.setServiceEndpoints(txServiceEndpoints);
  }

  if (data.gossipCaCertificate) {
    const uint8array = hexToUint8Array(data.gossipCaCertificate);
    if (uint8array.length > 0) {
      transaction.setGossipCaCertificate(uint8array);
    }
  }

  if (data.adminKey && oldData?.admin_key) {
    !compareKeys(data.adminKey, oldData?.admin_key) && transaction.setAdminKey(data.adminKey);
  } else if (data.adminKey) {
    transaction.setAdminKey(data.adminKey);
  }
};

/* Node Create */
export function createNodeCreateTransaction(data: TransactionCommonData & NodeData) {
  const transaction = new NodeCreateTransaction();
  setTransactionCommonData(transaction, data);
  setNodeData(transaction, data);
  return transaction;
}

/* Node Update */
export function createNodeUpdateTransaction(
  data: TransactionCommonData & NodeUpdateData,
  oldData: INodeInfoParsed | null,
) {
  const transaction = new NodeUpdateTransaction();
  setTransactionCommonData(transaction, data);
  setNodeData(transaction, data, oldData);

  if (data.nodeId) {
    transaction.setNodeId(data.nodeId);
  }

  return transaction;
}

/* Node Delete */
export function createNodeDeleteTransaction(
  data: TransactionCommonData & NodeDeleteData,
): NodeDeleteTransaction {
  const transaction = new NodeDeleteTransaction();
  setTransactionCommonData(transaction, data);

  if (data.nodeId) {
    transaction.setNodeId(data.nodeId);
  }

  return transaction;
}

const setSystemData = (
  transaction: SystemDeleteTransaction | SystemUndeleteTransaction,
  data: SystemData,
) => {
  if (isFileId(data.fileId)) {
    transaction.setFileId(data.fileId);
  }

  if (isContractId(data.contractId)) {
    transaction.setContractId(data.contractId);
  }
};

/* System Delete */
export function createSystemDeleteTransaction(
  data: TransactionCommonData & SystemDeleteData,
): SystemDeleteTransaction {
  const transaction = new SystemDeleteTransaction();
  setTransactionCommonData(transaction, data);
  setSystemData(transaction, data);

  if (data.expirationTime) {
    transaction.setExpirationTime(Timestamp.fromDate(data.expirationTime));
  }

  return transaction;
}

/* System Undelete */
export function createSystemUndeleteTransaction(
  data: TransactionCommonData & SystemUndeleteData,
): SystemUndeleteTransaction {
  const transaction = new SystemUndeleteTransaction();
  setTransactionCommonData(transaction, data);
  setSystemData(transaction, data);
  return transaction;
}
