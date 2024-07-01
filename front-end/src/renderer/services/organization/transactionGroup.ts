import { GroupItem } from './../../stores/storeTransactionGroup';
import { Network } from '@main/shared/enums';
import axios, { AxiosError } from 'axios';
import { throwIfNoResponse } from '.';
import { ITransaction } from '@main/shared/interfaces';
import { commonRequestHandler } from '@renderer/utils';

export interface ApiTransaction {
  name: string;
  description: string;
  body: string;
  network: Network;
  signature: string;
  creatorKeyId: number;
}

export interface ApiGroupItem {
  seq: number;
  transaction: ApiTransaction | ITransaction;
}

export interface IGroupItem {
  seq: number;
  transaction: ITransaction;
}

export interface IGroup {
  id: number;
  description: string;
  createdAt: string;
  groupItems: IGroupItem[];
}

export const submitTransactionGroup = async (
  serverUrl: string,
  description: string,
  atomic: boolean,
  groupItems: ApiGroupItem[],
): Promise<{ id: number; body: string }> => {
  return commonRequestHandler(async () => {
    const { data } = await axios.post(
      `${serverUrl}/transaction-groups`,
      {
        description,
        atomic,
        groupItems,
      },
      {
        withCredentials: true,
      },
    );

    return { id: data.id, body: '' };
  }, 'Failed submit transaction');
};

/* Get transaction groups */
export const getApiGroups = async (serverUrl: string, network: Network) => {
  return commonRequestHandler(async () => {
    const { data } = await axios.get(`${serverUrl}/transaction-groups/`, {
      withCredentials: true,
    });

    return data;
  }, 'Failed to get transaction groups');
};

/* Get transaction groups */
export const getApiGroupById = async (serverUrl: string, network: Network, id: number) => {
  return commonRequestHandler(async () => {
    const { data } = await axios.get(`${serverUrl}/transaction-groups/${id}`, {
      withCredentials: true,
    });

    return data;
  }, 'Failed to get transaction groups');
};
