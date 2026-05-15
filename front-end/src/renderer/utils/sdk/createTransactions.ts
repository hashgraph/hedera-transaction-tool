import type { IAccountInfoParsed, INodeInfoParsed } from '@shared/interfaces';

import {
  AccountAllowanceApproveTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountId,
  AccountUpdateTransaction,
  BlockNodeApi,
  BlockNodeServiceEndpoint,
  FileAppendTransaction,
  FileCreateTransaction,
  FileId,
  FileUpdateTransaction,
  FreezeTransaction,
  FreezeType,
  GeneralServiceEndpoint,
  Hbar,
  Key,
  KeyList,
  Long,
  MirrorNodeServiceEndpoint,
  NodeCreateTransaction,
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  RegisteredNodeCreateTransaction,
  RegisteredServiceEndpoint,
  RpcRelayServiceEndpoint,
  ServiceEndpoint,
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
  Timestamp,
  Transaction,
  TransactionId,
  Transfer,
  TransferTransaction,
} from '@hiero-ledger/sdk';

import { MEMO_MAX_LENGTH } from '@shared/constants';

import { isAccountId, isContractId, isFileId } from '../validator';
import { compareKeys } from '.';

export type TransactionCommonData = {
  payerId: string;
  validStart: Date;
  maxTransactionFee: Hbar;
  transactionMemo: string;
};

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

export type AccountUpdateDataMultiple = {
  accountIds: string[];
  accountIsPayer: boolean;
  key: Key | null;
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
  grpcWebProxyEndpoint: ComponentServiceEndpoint | null;
  gossipCaCertificate: Uint8Array;
  certificateHash: Uint8Array;
  adminKey: Key | null;
  declineReward: boolean;
};

export type NodeUpdateData = NodeData & {
  nodeId: string;
};

export type NodeDeleteData = {
  nodeId: string;
};

/* HIP-1137 — Registered Node */
export type RegisteredEndpointType =
  | 'blockNode'
  | 'mirrorNode'
  | 'rpcRelay'
  | 'generalService';

export interface ComponentRegisteredServiceEndpoint extends ComponentServiceEndpoint {
  type: RegisteredEndpointType;
  requiresTls: boolean;
  /** Block-node APIs (codes from `BlockNodeApi` static instances). Only used when `type === 'blockNode'`. */
  endpointApis?: number[];
  /** Free-text description for general-service endpoints. Only used when `type === 'generalService'`. */
  endpointDescription?: string;
  /**
   * Client-side-only stable identity used as the Vue list `:key`. Never
   * serialized to the proto wire. Generated once when the row is added so
   * delete/reorder operations keep the right DOM nodes attached to the right
   * data and don't shuffle focus between rows.
   */
  uiId?: string;
}

export type RegisteredNodeData = {
  description: string;
  adminKey: Key | null;
  serviceEndpoints: ComponentRegisteredServiceEndpoint[];
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

/* Account Delete Transaction */
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

/* Account Update Transaction */
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

export const getServiceEndpoints = (data: ComponentServiceEndpoint[]): ServiceEndpoint[] => {
  return data
    .map(getServiceEndpoint)
    .filter((endpoint): endpoint is ServiceEndpoint => endpoint !== null);
};

export const getServiceEndpoint = (serviceEndpoint: ComponentServiceEndpoint | null) => {
  if (!serviceEndpoint) {
    return null;
  }
  const ipAddressV4 =
    serviceEndpoint.ipAddressV4
      ?.trim()
      ?.split('.')
      .filter(oct => oct.length > 0) || [];
  const domainName = serviceEndpoint.domainName?.trim();
  const port = Number.parseInt(serviceEndpoint.port?.trim());

  if (ipAddressV4.length > 0 || domainName) {
    const serviceEndpoint = new ServiceEndpoint();

    if (ipAddressV4.length > 0) {
      serviceEndpoint.setIpAddressV4(Uint8Array.from(ipAddressV4.map(Number)));
    } else if (domainName) {
      serviceEndpoint.setDomainName(domainName);
    }

    if (!isNaN(port)) {
      serviceEndpoint.setPort(port);
    }
    return serviceEndpoint;
  }

  return null;
};

const setNodeData = (
  transaction: NodeCreateTransaction | NodeUpdateTransaction,
  data: NodeData,
  oldData?: INodeInfoParsed | null,
) => {
  const txGossipEndpoints = getServiceEndpoints(data.gossipEndpoints);
  const txServiceEndpoints = getServiceEndpoints(data.serviceEndpoints);
  const txGrpcWebProxyEndpoint = getServiceEndpoint(data.grpcWebProxyEndpoint);

  if (oldData?.description !== data.description) {
    transaction.setDescription(data.description);
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

  if (oldData?.grpc_web_proxy_endpoint != data.grpcWebProxyEndpoint && txGrpcWebProxyEndpoint) {
    transaction.setGrpcWebProxyEndpoint(txGrpcWebProxyEndpoint);
  }

  if (data.certificateHash.length > 0) {
    transaction.setCertificateHash(data.certificateHash);
  }

  if (data.gossipCaCertificate.length > 0) {
    transaction.setGossipCaCertificate(data.gossipCaCertificate);
  }

  if (data.adminKey && oldData?.admin_key) {
    !compareKeys(data.adminKey, oldData?.admin_key) && transaction.setAdminKey(data.adminKey);
  } else if (data.adminKey) {
    transaction.setAdminKey(data.adminKey);
  }

  if (oldData?.decline_reward !== data.declineReward) {
    transaction.setDeclineReward(data.declineReward);
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
    transaction.setNodeId(Long.fromString(data.nodeId));
  }

  return transaction;
}

/* HIP-1137 — Registered Node */

/**
 * Set of `BlockNodeApi` numeric codes the *currently-installed* SDK knows about.
 * Built once at module load from the SDK's enumerable static instances. Used
 * by `buildRegisteredServiceEndpoint` to filter out any unknown codes before
 * calling `setEndpointApis(...)` — without this guard, the SDK internally
 * routes each numeric input through `BlockNodeApi._fromCode(n)` which THROWS
 * `(BUG) BlockNodeApi._fromCode() does not handle code: N` for any code not
 * baked into this SDK version. That crash is reachable from drafts saved on a
 * future SDK release with a new enum entry.
 */
const KNOWN_BLOCK_NODE_API_CODES: ReadonlySet<number> = new Set(
  Object.values(BlockNodeApi as unknown as Record<string, unknown>)
    .filter((v): v is InstanceType<typeof BlockNodeApi> => v instanceof BlockNodeApi)
    .map(api => Number(api)),
);

/**
 * Strict IPv4 parser. Rejects octets that aren't pure decimal digits, so
 * `"01"`, `"0xa"`, `"1e2"`, `"+1"`, `"  "`, `"5 "` all fail rather than
 * being silently coerced by `Number()`. The proto contract says IPv4 = 4
 * bytes big-endian; we never want the bytes on the wire to disagree with
 * what the user typed.
 */
export const parseIpv4ToBytes = (ipAddressV4: string): Uint8Array | null => {
  if (!ipAddressV4) return null;
  const octets = ipAddressV4.trim().split('.');
  if (octets.length !== 4) return null;
  const parsed: number[] = [];
  for (const octet of octets) {
    if (!/^[0-9]{1,3}$/.test(octet)) return null;
    const n = Number(octet);
    if (n < 0 || n > 255) return null;
    parsed.push(n);
  }
  return Uint8Array.from(parsed);
};

/** Strict port parser: requires pure-digit string, returns null on empty / non-digit / out-of-range. */
export const parsePort = (port: string): number | null => {
  const trimmed = port.trim();
  if (!/^[0-9]+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (n < 0 || n > 65535) return null;
  return n;
};

const applyRegisteredEndpointBase = (
  endpoint: RegisteredServiceEndpoint,
  data: ComponentRegisteredServiceEndpoint,
) => {
  const ipBytes = parseIpv4ToBytes(data.ipAddressV4 ?? '');
  if (ipBytes) {
    endpoint.setIpAddress(ipBytes);
  } else if (data.domainName?.trim()) {
    endpoint.setDomainName(data.domainName.trim());
  }

  const port = parsePort(data.port ?? '');
  if (port !== null) {
    endpoint.setPort(port);
  }

  endpoint.setRequiresTls(Boolean(data.requiresTls));
};

export const buildRegisteredServiceEndpoint = (
  data: ComponentRegisteredServiceEndpoint,
): RegisteredServiceEndpoint | null => {
  if (!data?.type) return null;

  // proto `oneof address` requires exactly one of ip_address / domain_name.
  // A non-empty `ipAddressV4` field that doesn't parse to 4 valid octets must
  // NOT silently fall through to domain (which is empty) — otherwise we'd ship
  // an endpoint with no address and the chain would return an opaque
  // INVALID_REGISTERED_ENDPOINT_ADDRESS. `preCreateAssert` rejects this earlier,
  // but this helper is also called from getData round-trip and external paths,
  // so be defensive here too.
  const hasIp = Boolean(data.ipAddressV4?.trim());
  const hasDomain = Boolean(data.domainName?.trim());
  if (!hasIp && !hasDomain) return null;
  if (hasIp && parseIpv4ToBytes(data.ipAddressV4 ?? '') === null) return null;
  // Symmetric port guard so non-form callers (drafts, external paths) can't
  // produce an endpoint with the SDK's default port=0 just because the port
  // string is empty/malformed.
  if (parsePort(data.port ?? '') === null) return null;

  switch (data.type) {
    case 'blockNode': {
      const endpoint = new BlockNodeServiceEndpoint();
      applyRegisteredEndpointBase(endpoint, data);
      // The SDK's `BlockNodeServiceEndpoint.setEndpointApis` routes each
      // numeric input through `BlockNodeApi._fromCode(code)`, which throws on
      // any code outside the SDK's known set. Filter unknown codes against
      // `KNOWN_BLOCK_NODE_API_CODES` (derived from the running SDK) to avoid
      // crashing the build for drafts saved on a future SDK release.
      const apis = (data.endpointApis ?? []).filter(code =>
        KNOWN_BLOCK_NODE_API_CODES.has(code),
      );
      if (apis.length > 0) {
        endpoint.setEndpointApis(apis);
      }
      return endpoint;
    }
    case 'mirrorNode': {
      const endpoint = new MirrorNodeServiceEndpoint();
      applyRegisteredEndpointBase(endpoint, data);
      return endpoint;
    }
    case 'rpcRelay': {
      const endpoint = new RpcRelayServiceEndpoint();
      applyRegisteredEndpointBase(endpoint, data);
      return endpoint;
    }
    case 'generalService': {
      const endpoint = new GeneralServiceEndpoint();
      applyRegisteredEndpointBase(endpoint, data);
      if (data.endpointDescription?.trim()) {
        endpoint.setDescription(data.endpointDescription.trim());
      }
      return endpoint;
    }
    default:
      return null;
  }
};

export const getRegisteredServiceEndpoints = (
  data: ComponentRegisteredServiceEndpoint[],
): RegisteredServiceEndpoint[] =>
  data
    .map(buildRegisteredServiceEndpoint)
    .filter((e): e is RegisteredServiceEndpoint => e !== null);

export function createRegisteredNodeCreateTransaction(
  data: TransactionCommonData & RegisteredNodeData,
): RegisteredNodeCreateTransaction {
  const transaction = new RegisteredNodeCreateTransaction();
  setTransactionCommonData(transaction, data);

  if (data.adminKey) {
    transaction.setAdminKey(data.adminKey);
  }

  if (data.description && data.description.length > 0) {
    transaction.setDescription(data.description);
  }

  const endpoints = getRegisteredServiceEndpoints(data.serviceEndpoints);
  if (endpoints.length > 0) {
    transaction.setServiceEndpoints(endpoints);
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
    transaction.setNodeId(Long.fromString(data.nodeId));
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
