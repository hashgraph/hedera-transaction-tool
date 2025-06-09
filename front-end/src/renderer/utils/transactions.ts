import type { IDefaultNetworks, Network } from '@main/shared/interfaces';
import type { KeyPair, Transaction } from '@prisma/client';

import {
  Timestamp,
  Status,
  TransactionReceipt,
  Transaction as Tx,
  TransactionId,
  Key,
} from '@hashgraph/sdk';

import { CommonNetwork } from '@main/shared/enums';
import { TransactionStatus } from '@main/shared/interfaces';

import { openExternal } from '@renderer/services/electronUtilsService';
import { flattenKeyList } from '@renderer/services/keyPairService';

export const getTransactionDate = (transaction: Transaction): string => {
  return new Timestamp(
    Number(transaction.transaction_id.split('@')[1].split('.')[0]),
    Number(transaction.transaction_id.split('@')[1].split('.')[1]),
  )
    .toDate()
    .toDateString();
};

export const getTransactionId = (transaction: Transaction): string => {
  const transactionId = TransactionId.fromString(transaction.transaction_id);
  // return `${transactionId.accountId?.toString()}@${transactionId.validStart?.seconds.toString()}`;
  return transactionId.toString();
};

export const getTransactionPayerId = (transaction: Transaction): string => {
  return transaction.transaction_id.split('@')[0];
};

export const getTransactionValidStart = (transaction: Transaction) => {
  const transactionId = TransactionId.fromString(transaction.transaction_id);
  return transactionId.validStart;
};

export const getTransactionStatus = (transaction: Transaction): string => {
  try {
    return Status._fromCode(transaction.status_code).toString().split('_').join(' ');
  } catch {
    return 'UNKNOWN';
  }
};

export const getPayerFromTransaction = (transaction: Transaction): number => {
  return Number(transaction.transaction_id.split('@')[0].split('.').join(''));
};

export const getStatusFromCode = (code?: number): string | null => {
  if (code === undefined || code === null) {
    return null;
  }

  try {
    return Status._fromCode(code).toString();
  } catch {
    return 'UNKNOWN';
  }
};

export const getFormattedDateFromTimestamp = (timestamp: Timestamp): string => {
  return new Date(timestamp.seconds.multiply(1000).toNumber()).toDateString();
};

export const openTransactionInHashscan = (transactionId: string, network: Network) => {
  [CommonNetwork.MAINNET, CommonNetwork.PREVIEWNET, CommonNetwork.TESTNET].includes(network) &&
    openExternal(`https://hashscan.io/${network}/transaction/${transactionId}`);
};

export const getEntityIdFromTransactionReceipt = (
  receipt: TransactionReceipt,
  entityType: 'fileId' | 'accountId',
) => {
  const entity = receipt[entityType];

  if (!entity || entity === null) {
    throw new Error('No entity provided');
  }

  return entity.toString();
};

/* Parses a transaction bytes string to a transaction */
export const getTransactionFromBytes = <T extends Tx>(transactionBytes: string): T => {
  const bytesArray = transactionBytes.split(',').map(n => Number(n));
  return Tx.fromBytes(Uint8Array.from(bytesArray)) as T;
};

/* Gets the label for the transaction propagation button */
export const getPropagationButtonLabel = (
  transactionKey: Key,
  userKeys: KeyPair[],
  activeOrganization: boolean,
): string => {
  if (activeOrganization) {
    const userPublicKeys = userKeys.map(key => key.public_key);
    const publicKeys = flattenKeyList(transactionKey);

    const publicKeysRaw = publicKeys.map(pk => pk.toStringRaw());
    const publicKeysDer = publicKeys.map(pk => pk.toStringRaw());

    const userKeyRequired = userPublicKeys.some(userKey => {
      return publicKeysRaw.includes(userKey) || publicKeysDer.includes(userKey);
    });

    return userKeyRequired ? 'Create' : 'Create and Share';
  } else {
    return 'Sign & Execute';
  }
};

export const normalizeNetworkName = (network: string): IDefaultNetworks | 'custom' => {
  const defaultNetworks = ['mainnet', 'testnet', 'previewnet', 'local-node'];
  if (defaultNetworks.includes(network)) {
    return network as IDefaultNetworks;
  } else {
    return 'custom';
  }
};

const TransactionStatusName = {
  [TransactionStatus.NEW]: 'New',
  [TransactionStatus.CANCELED]: 'Canceled',
  [TransactionStatus.REJECTED]: 'Rejected',
  [TransactionStatus.WAITING_FOR_SIGNATURES]: 'Waiting for Signatures',
  [TransactionStatus.WAITING_FOR_EXECUTION]: 'Waiting for Execution',
  [TransactionStatus.EXECUTED]: 'Executed',
  [TransactionStatus.FAILED]: 'Failed',
  [TransactionStatus.EXPIRED]: 'Expired',
  [TransactionStatus.ARCHIVED]: 'Archived',
};

export const getTransactionStatusName = (status: TransactionStatus, uppercase: boolean = false): string => {
  const statusName = TransactionStatusName[status];
  return uppercase ? statusName.toUpperCase() : statusName;
};
