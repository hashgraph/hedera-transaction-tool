import type { ITransaction, ITransactionFull } from '@shared/interfaces';

import { axiosWithCredentials, commonRequestHandler, hexToUint8Array } from '@renderer/utils';
import { type PrivateKey, Transaction } from '@hashgraph/sdk';
import { javaFormatArrayHashCode } from '@shared/utils/byteUtils.ts';
import { format } from 'date-fns';

export interface ApiGroupItem {
  seq: number;
  transaction: Partial<ITransaction>;
}

export interface IGroupItem {
  seq: number;
  transaction: ITransaction;
}

export interface IGroup {
  id: number;
  description: string;
  atomic: boolean;
  sequential: boolean;
  createdAt: string;
  groupValidStart: Date;
  groupItems: IGroupItem[];
}

export const submitTransactionGroup = async (
  serverUrl: string,
  description: string,
  atomic: boolean,
  sequential: boolean,
  groupItems: ApiGroupItem[],
): Promise<{ id: number; transactionBytes: string }> => {
  return commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.post(
      `${serverUrl}/transaction-groups`,
      {
        description,
        atomic,
        sequential,
        groupItems,
      },
      {
        withCredentials: true,
      },
    );

    return { id: data.id, transactionBytes: '' };
  }, 'Failed submit transaction');
};

/* Get transaction groups */
export const getApiGroups = async (serverUrl: string) => {
  return commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.get(`${serverUrl}/transaction-groups/`, {
      withCredentials: true,
    });

    return data;
  }, 'Failed to get transaction groups');
};

/* Get transaction groups */
export const getApiGroupById = async (serverUrl: string, id: number) => {
  return commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.get(`${serverUrl}/transaction-groups/${id}`, {
      withCredentials: true,
    });

    return data;
  }, 'Failed to get transaction groups');
};

export const generateTransactionExportContent = async (
  orgTransaction: ITransactionFull,
  key: PrivateKey,
  defaultDescription?: string
) => {
  const transactionBytes = hexToUint8Array(orgTransaction.transactionBytes);
  const sdkTransaction = Transaction.fromBytes(transactionBytes);

  // create .tx file contents
  const signedBytes = (await sdkTransaction.sign(key)).toBytes();

  // create .txt file contents
  const author = orgTransaction.creatorEmail;
  const contents = orgTransaction.description || defaultDescription || '';
  const timestamp = new Date(orgTransaction.createdAt);
  const formattedTimestamp = format(timestamp, 'yyyy-MM-dd HH:mm:ss');

  const jsonContent = JSON.stringify({
    Author: author,
    Contents: contents,
    Timestamp: formattedTimestamp,
  });

  return Promise.resolve({
    signedBytes,
    jsonContent,
  });
};

export const generateTransactionExportFileName = (orgTransaction: ITransactionFull) => {
  const transactionBytes = hexToUint8Array(orgTransaction.transactionBytes);
  const sdkTransaction = Transaction.fromBytes(transactionBytes);

  // Use TTv1 file name format:  `${epochSeconds}_${accountId}_${hash}.tx`
  const validStart = sdkTransaction!.transactionId!.validStart;
  const accountId = sdkTransaction.transactionId!.accountId!.toString();
  const hash = javaFormatArrayHashCode(transactionBytes);

  return `${validStart!.seconds}_${accountId}_${hash}`;
};
