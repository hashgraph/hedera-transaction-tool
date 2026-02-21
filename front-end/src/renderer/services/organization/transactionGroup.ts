import type { ITransaction } from '@shared/interfaces';
import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';

export interface ApiGroupItem {
  seq: number;
  transaction: Partial<ITransaction>;
}

export interface IGroupItem {
  seq: number;
  transactionId: number;
  transaction: ITransaction;
}

export interface IGroup {
  id: number;
  description: string;
  atomic: boolean;
  sequential: boolean;
  createdAt: string;
  groupValidStart: string;
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
export const getTransactionGroups = async (serverUrl: string) => {
  return commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.get(`${serverUrl}/transaction-groups/`, {
      withCredentials: true,
    });

    return data;
  }, 'Failed to get transaction groups');
};

/* Get transaction groups */
export const getTransactionGroupById = async (serverUrl: string, id: number, full?: boolean) => {
  return commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.get<IGroup>(
      `${serverUrl}/transaction-groups/${id}`,
      {
        withCredentials: true,
        params: full !== undefined ? { full } : undefined,
      },
    );

    return data;
  }, 'Failed to get transaction groups');
};
