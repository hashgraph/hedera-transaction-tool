import {
  AccountAllowanceApproveTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountUpdateTransaction,
  BlockNodeServiceEndpoint,
  FileAppendTransaction,
  FileCreateTransaction,
  FileUpdateTransaction,
  FreezeTransaction,
  GeneralServiceEndpoint,
  Hbar,
  KeyList,
  MirrorNodeServiceEndpoint,
  NodeCreateTransaction,
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  RegisteredNodeCreateTransaction,
  RegisteredNodeDeleteTransaction,
  RegisteredNodeUpdateTransaction,
  type RegisteredServiceEndpoint,
  RpcRelayServiceEndpoint,
  ServiceEndpoint,
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
  Timestamp,
  type Transaction,
  TransferTransaction,
} from '@hiero-ledger/sdk';

import type {
  AccountCreateData,
  AccountData,
  AccountDeleteData,
  AccountUpdateData,
  ApproveHbarAllowanceData,
  ComponentRegisteredServiceEndpoint,
  ComponentServiceEndpoint,
  FileAppendData,
  FileCreateData,
  FileData,
  FileUpdateData,
  FreezeData,
  NodeData,
  NodeDeleteData,
  NodeUpdateData,
  RegisteredEndpointType,
  RegisteredNodeData,
  RegisteredNodeDeleteData,
  RegisteredNodeUpdateData,
  SystemData,
  SystemDeleteData,
  SystemUndeleteData,
  TransactionCommonData,
  TransferHbarData,
} from '@renderer/utils';
import { getMaximumExpirationTime, getMinimumExpirationTime } from '.';
import { uint8ToHex } from '..';

export type ExtendedTransactionData = TransactionCommonData &
  (
    | AccountCreateData
    | AccountUpdateData
    | AccountDeleteData
    | ApproveHbarAllowanceData
    | FileCreateData
    | FileUpdateData
    | FileAppendData
    | FreezeData
    | TransferHbarData
    | NodeData
    | NodeUpdateData
    | NodeDeleteData
    | RegisteredNodeData
    | SystemDeleteData
    | SystemUndeleteData
  );

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
    stakeType: transaction.stakedAccountId
      ? 'Account'
      : transaction.stakedNodeId !== null
        ? 'Node'
        : 'None',
    stakedAccountId: transaction.stakedAccountId?.toString() || '',
    stakedNodeId: transaction.stakedNodeId !== null ? transaction.stakedNodeId.toNumber() : null,
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

export const getComponentServiceEndpoint = (
  serviceEndpoint: ServiceEndpoint | null,
): ComponentServiceEndpoint | null => {
  if (!serviceEndpoint) {
    return null;
  }

  const ipAddressV4 =
    serviceEndpoint.getIpAddressV4 && serviceEndpoint.getIpAddressV4.length > 0
      ? serviceEndpoint.getIpAddressV4.join('.')
      : '';
  const port = serviceEndpoint.getPort ? serviceEndpoint.getPort.toString() : '';
  const domainName = serviceEndpoint.getDomainName || '';

  return {
    ipAddressV4,
    port,
    domainName,
  };
};

export const getComponentServiceEndpoints = (
  serviceEndpoints: ServiceEndpoint[],
): ComponentServiceEndpoint[] => {
  const result =  serviceEndpoints.map(getComponentServiceEndpoint);
  return result.filter((i) => i !== null)
};

export function getNodeData(transaction: Transaction): NodeData {
  if (
    !(transaction instanceof NodeCreateTransaction) &&
    !(transaction instanceof NodeUpdateTransaction)
  ) {
    throw new Error('Invalid transaction type.');
  }

  const gossipEndpoints = getComponentServiceEndpoints(transaction.gossipEndpoints || []);
  const serviceEndpoints = getComponentServiceEndpoints(transaction.serviceEndpoints || []);
  const grpcWebProxyEndpoint = getComponentServiceEndpoint(transaction.grpcWebProxyEndpoint);
  return {
    nodeAccountId: transaction.accountId?.toString() || '',
    description: transaction.description || '',
    gossipEndpoints: gossipEndpoints || [],
    grpcWebProxyEndpoint,
    serviceEndpoints: serviceEndpoints || [],
    gossipCaCertificate: transaction.gossipCaCertificate || Uint8Array.from([]),
    certificateHash: transaction.certificateHash || Uint8Array.from([]),
    adminKey: transaction.adminKey,
    declineReward: transaction.declineReward || false,
    associatedRegisteredNodes: [
      ...new Set(transaction.associatedRegisteredNodes?.map(id => id.toString()) ?? []),
    ],
  };
}

export function getNodeUpdateData(transaction: Transaction): NodeUpdateData {
  assertTransactionType(transaction, NodeUpdateTransaction);
  return {
    nodeId: transaction.nodeId?.toString() || '',
    ...getNodeData(transaction),
  };
}

export function getNodeDeleteData(transaction: Transaction): NodeDeleteData {
  assertTransactionType(transaction, NodeDeleteTransaction);
  return {
    nodeId: transaction.nodeId?.toString() || '',
  };
}

/* HIP-1137 — Registered Node */
const getRegisteredEndpointType = (
  endpoint: RegisteredServiceEndpoint,
): RegisteredEndpointType => {
  if (endpoint instanceof BlockNodeServiceEndpoint) return 'blockNode';
  if (endpoint instanceof MirrorNodeServiceEndpoint) return 'mirrorNode';
  if (endpoint instanceof RpcRelayServiceEndpoint) return 'rpcRelay';
  if (endpoint instanceof GeneralServiceEndpoint) return 'generalService';
  // Fallback: trust the base-class `type` getter if subclass detection misses.
  return endpoint.type;
};

/**
 * Converts an IP (v4 or v6) address represented as a Uint8Array into a string.
 * In the case of an IPv6 address, this returns the (compressed) canonical text representation
 * defined in RFC 5952 §4.
 * For instance: 2001:0db8:0000:0000:0000:ff00:0042:8329
 * becomes:      2001:db8::ff00:42:8329
 */
export function stringifyIpAddressBytes(ipBytes: Uint8Array | null | undefined): string {
  if (!ipBytes) return '';
  if (ipBytes.length === 4) return Array.from(ipBytes).join('.');
  if (ipBytes.length === 16) {
    const groups: string[] = [];
    for (let i = 0; i < 16; i += 2) {
      groups.push(((ipBytes[i] << 8) | ipBytes[i + 1]).toString(16));
    }

    // Find the longest run of consecutive groups of only zeros for '::'.
    // Choose the first run in case of multiple runs of the same length.
    let bestStart = -1;
    let bestLen = 0;
    let runStart = -1;
    let runLen = 0;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i] === '0') {
        if (runStart === -1) {
          runStart = i;
          runLen = 0;
        }
        runLen++;
        if (runLen > bestLen) {
          bestLen = runLen;
          bestStart = runStart;
        }
      } else {
        runStart = -1;
      }
    }

    // Minimal length to compress groups of only zeros is 2 groups.
    if (bestLen < 2) return groups.join(':');

    const before = groups.slice(0, bestStart).join(':');
    const after = groups.slice(bestStart + bestLen).join(':');
    return `${before}::${after}`;
  }
  return '';
}

/**
 * Extract an endpoint from a decoded SDK transaction back into the FE-facing
 * shape. Deliberately does NOT populate `uiId` — that field is a render-side
 * concern owned by the form component (see `decorateEndpointsWithUiIds` in
 * `RegisteredNodeCreate.vue`). Including `uiId` here would make every call to
 * `transactionsDataMatch` produce mismatched JSON (uiIds are freshly generated
 * per call), spuriously marking every loaded draft as "unsaved".
 */
export const getComponentRegisteredEndpoint = (
  endpoint: RegisteredServiceEndpoint,
): ComponentRegisteredServiceEndpoint => {
  const ipAddressV4 = stringifyIpAddressBytes(endpoint.ipAddress);
  const base: ComponentRegisteredServiceEndpoint = {
    ipAddressV4,
    port: endpoint.port != null ? endpoint.port.toString() : '',
    domainName: endpoint.domainName ?? '',
    type: getRegisteredEndpointType(endpoint),
    requiresTls: Boolean(endpoint.requiresTls),
  };

  if (endpoint instanceof BlockNodeServiceEndpoint) {
    // Use Number(api), which calls BlockNodeApi.valueOf() → numeric code.
    // Avoids reaching into the SDK's underscore-prefixed `_code` field.
    base.endpointApis = (endpoint.endpointApis ?? []).map(api => Number(api));
  } else if (endpoint instanceof GeneralServiceEndpoint) {
    base.endpointDescription = endpoint.description ?? '';
  }

  return base;
};

export const getComponentRegisteredEndpoints = (endpoints: RegisteredServiceEndpoint[]):
  ComponentRegisteredServiceEndpoint[] => {
  return endpoints.map(endpoint => getComponentRegisteredEndpoint(endpoint));
};

export function getRegisteredNodeData(transaction: Transaction): RegisteredNodeData {
  assertTransactionType(transaction, RegisteredNodeCreateTransaction);

  const endpoints = (transaction.serviceEndpoints ?? []).map(
    getComponentRegisteredEndpoint,
  );

  return {
    description: transaction.description ?? '',
    adminKey: transaction.adminKey ?? null,
    serviceEndpoints: endpoints,
  };
}

export function getRegisteredNodeUpdateData(transaction: Transaction): RegisteredNodeUpdateData {
  assertTransactionType(transaction, RegisteredNodeUpdateTransaction);

  const endpoints = (transaction.serviceEndpoints ?? []).map(getComponentRegisteredEndpoint);

  return {
    registeredNodeId: transaction.registeredNodeId?.toString() ?? '',
    description: transaction.description ?? '',
    adminKey: transaction.adminKey ?? null,
    serviceEndpoints: endpoints,
  };
}

export function getRegisteredNodeDeleteData(transaction: Transaction): RegisteredNodeDeleteData {
  assertTransactionType(transaction, RegisteredNodeDeleteTransaction);
  return {
    registeredNodeId: transaction.registeredNodeId?.toString() ?? '',
  };
}

export function getSystemData(
  transaction: SystemDeleteTransaction | SystemUndeleteTransaction,
): SystemData {
  return {
    fileId: transaction.fileId?.toString() || '',
    contractId: transaction.contractId?.toString() || '',
  };
}

export function getSystemDeleteData(transaction: Transaction): SystemDeleteData {
  assertTransactionType(transaction, SystemDeleteTransaction);
  return {
    ...getSystemData(transaction),
    expirationTime: transaction.expirationTime?.toDate() || null,
  };
}

export function getSystemUndeleteData(transaction: Transaction): SystemUndeleteData {
  assertTransactionType(transaction, SystemUndeleteTransaction);
  return getSystemData(transaction);
}

const transactionHandlers = new Map<
  new (...args: any[]) => Transaction,
  (transaction: Transaction) => Record<string, any>
>([
  [
    AccountCreateTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getAccountData(tx),
      ...getAccountCreateData(tx),
    }),
  ],

  [
    AccountUpdateTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getAccountUpdateData(tx),
    }),
  ],

  [
    AccountAllowanceApproveTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getApproveHbarAllowanceTransactionData(tx),
    }),
  ],

  [
    AccountDeleteTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getAccountDeleteData(tx),
    }),
  ],

  [
    FileCreateTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getFileInfoTransactionData(tx),
      ...getFileCreateTransactionData(tx),
    }),
  ],

  [
    FileUpdateTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getFileInfoTransactionData(tx),
      ...getFileUpdateTransactionData(tx),
    }),
  ],

  [
    FileAppendTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getFileAppendTransactionData(tx),
    }),
  ],

  [
    FreezeTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getFreezeData(tx),
    }),
  ],

  [
    TransferTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getTransferHbarData(tx),
    }),
  ],

  [
    NodeCreateTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getNodeData(tx),
    }),
  ],

  [
    NodeUpdateTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getNodeData(tx),
      ...getNodeUpdateData(tx),
    }),
  ],

  [
    NodeDeleteTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getNodeDeleteData(tx),
    }),
  ],

  [
    RegisteredNodeCreateTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getRegisteredNodeData(tx),
    }),
  ],

  [
    RegisteredNodeUpdateTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getRegisteredNodeUpdateData(tx),
    }),
  ],

  [
    RegisteredNodeDeleteTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getRegisteredNodeDeleteData(tx),
    }),
  ],

  [
    SystemDeleteTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getSystemDeleteData(tx),
    }),
  ],

  [
    SystemUndeleteTransaction,
    tx => ({
      ...getTransactionCommonData(tx),
      ...getSystemUndeleteData(tx),
    }),
  ],
]);

export function getAllData(transaction: Transaction) {
  const handler = transactionHandlers.get(
    transaction.constructor as new (...args: any[]) => ExtendedTransactionData & Transaction,
  );
  if (!handler) {
    throw new Error('Unsupported transaction type');
  }
  return handler(transaction);
}

export function hasStartTimestampChanged(
  initial: Transaction | null,
  current: Transaction,
  now: Timestamp,
): boolean {
  if (!(initial instanceof FreezeTransaction) || !(current instanceof FreezeTransaction)) {
    return false;
  }

  const initialStart = initial.startTimestamp;
  const currentStart = current.startTimestamp;

  if (!initialStart || !currentStart) {
    return false;
  }

  return initialStart.compare(currentStart) !== 0 &&
    (initialStart.compare(now) > 0 || currentStart.compare(now) > 0);
}

export function transactionsDataMatch(t1: Transaction, t2: Transaction): boolean {
  const t1Data = getAllData(t1);
  const t2Data = getAllData(t2);
  t1Data.validStart = undefined
  t2Data.validStart = undefined
  t1Data.startTimestamp = undefined;
  t2Data.startTimestamp = undefined;
  // Defensive: `uiId` is a render-side stable key for endpoint rows and must
  // never affect the "has the user edited anything?" comparison. The current
  // `getRegisteredNodeData` does not emit it, but strip here too so that any
  // future code path which accidentally carries it through is harmless.
  stripUiIds(t1Data);
  stripUiIds(t2Data);
  return JSON.stringify(t1Data) === JSON.stringify(t2Data);
}

const stripUiIds = (data: Record<string, unknown>) => {
  const endpoints = data['serviceEndpoints'];
  if (Array.isArray(endpoints)) {
    for (const ep of endpoints) {
      if (ep && typeof ep === 'object' && 'uiId' in ep) {
        delete (ep as { uiId?: unknown }).uiId;
      }
    }
  }
};
