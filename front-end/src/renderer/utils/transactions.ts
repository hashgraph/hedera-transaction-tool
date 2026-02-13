import type { Network } from '@shared/interfaces';
import type { KeyPair, Transaction } from '@prisma/client';

import { Key, Status, Timestamp, Transaction as Tx, TransactionReceipt } from '@hashgraph/sdk';

import { CommonNetwork } from '@shared/enums';

import { openExternal } from '@renderer/services/electronUtilsService';

export const getTransactionStatus = (transaction: Transaction): string => {
  try {
    return Status._fromCode(transaction.status_code).toString().split('_').join(' ');
  } catch {
    return 'UNKNOWN';
  }
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
  _transactionKey: Key,
  _userKeys: KeyPair[],
  activeOrganization: boolean,
): string => {
  if (activeOrganization) {
    return 'Create and Share';
  } else {
    return 'Sign & Execute';
  }
};
