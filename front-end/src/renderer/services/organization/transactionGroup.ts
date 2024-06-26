import { Network } from '@main/shared/enums';
import axios, { AxiosError } from 'axios';
import { throwIfNoResponse } from '.';

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
  transaction: ApiTransaction;
}

export const submitTransactionGroup = async (
  serverUrl: string,
  description: string,
  atomic: boolean,
  groupItems: ApiGroupItem[],
): Promise<{ id: number; body: string }> => {
  try {
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
  } catch (error: any) {
    let message = 'Failed submit transaction';

    if (error instanceof AxiosError) {
      throwIfNoResponse(error);

      const errorMessage = error.response?.data?.message;
      if ([400, 401].includes(error.response?.status || 0) && message.length > 0) {
        message = errorMessage;
      }
    }
    throw new Error(message);
  }
};

/* Get transaction groups */
export const getApiGroups = async (serverUrl: string, network: Network) => {
  try {
    const { data } = await axios.get(`${serverUrl}/transaction-groups/`, {
      withCredentials: true,
    });

    return data;
  } catch (error: any) {
    let message = 'Failed to get transaction groups';

    if (error instanceof AxiosError) {
      throwIfNoResponse(error);

      const errorMessage = error.response?.data?.message;
      if ([400, 401].includes(error.response?.status || 0) && message.length > 0) {
        message = errorMessage;
      }
    }
    throw new Error(message);
  }
};
