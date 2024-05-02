import axios, { AxiosError } from 'axios';

import { Transaction } from '@hashgraph/sdk';
import { Organization } from '@prisma/client';

import { LoggedInOrganization, LoggedInUserWithPassword } from '@renderer/types';

import { getPrivateKey, getSignatures } from '@renderer/utils';
import {
  ITransaction,
  ITransactionFull,
  PaginatedResourceDto,
  TransactionStatus,
} from '@main/shared/interfaces';

import { decryptPrivateKey } from '../keyPairService';

import { throwIfNoResponse } from '.';

const controller = 'transactions';

/* Submits a transaction to the back end */
export const submitTransaction = async (
  serverUrl: string,
  name: string,
  description: string,
  body: string,
  signature: string,
  creatorKeyId: number,
): Promise<{ id: number; body: string }> => {
  try {
    const { data } = await axios.post(
      `${serverUrl}/${controller}`,
      {
        name,
        description,
        body,
        signature,
        creatorKeyId,
      },
      {
        withCredentials: true,
      },
    );

    return { id: data.id, body: data.body };
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

/* Uploads signatures to the back end */
export const uploadSignature = async (
  serverUrl: string,
  transactionId: number,
  publicKeyId: number,
  signatures: { [key: string]: string },
): Promise<void> => {
  try {
    await axios.post(
      `${serverUrl}/${controller}/${transactionId}/signers`,
      {
        publicKeyId,
        signatures,
      },
      {
        withCredentials: true,
      },
    );
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

/* Decrypt, sign, upload signatures to the backend */
export const fullUploadSignatures = async (
  user: LoggedInUserWithPassword,
  organization: LoggedInOrganization & Organization,
  publicKeys: string[],
  transaction: Transaction,
  transactionId: number,
) => {
  const signaturesArray: { publicKeyId: number; signatures: { [key: string]: string } }[] = [];

  for (const publicKey of publicKeys) {
    const privateKeyRaw = await decryptPrivateKey(user.id, user.password, publicKey);
    const privateKey = getPrivateKey(publicKey, privateKeyRaw);

    const signatures = await getSignatures(privateKey, transaction);

    signaturesArray.push({
      publicKeyId: organization.userKeys.find(k => k.publicKey === publicKey)?.id || -1,
      signatures,
    });
  }

  try {
    await axios.post(
      `${organization.serverUrl}/${controller}/${transactionId}/signers/many`,
      {
        signatures: signaturesArray,
      },
      {
        withCredentials: true,
      },
    );
  } catch (error: any) {
    let message = 'Failed upload signatures';

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

/* Get transactions to sign */
export const getTransactionsToSign = async (
  serverUrl: string,
  page: number,
  size: number,
): Promise<
  PaginatedResourceDto<{
    transaction: ITransaction;
    keysToSign: number[];
  }>
> => {
  try {
    const { data } = await axios.get(`${serverUrl}/${controller}/sign?page=${page}&size=${size}`, {
      withCredentials: true,
    });

    return data;
  } catch (error: any) {
    let message = 'Failed to get transactions to sign';

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

/* Get the count of the transactions to sign */
export const getTransactionById = async (
  serverUrl: string,
  id: number,
): Promise<ITransactionFull> => {
  try {
    const { data } = await axios.get(`${serverUrl}/${controller}/${id}`, {
      withCredentials: true,
    });

    return data;
  } catch (error: any) {
    let message = `Failed to get transaction with id ${id}`;

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

/* Get transactions for user with specific status */
export const getTransactionsForUser = async (
  serverUrl: string,
  status: TransactionStatus[],
  page: number,
  size: number,
): Promise<PaginatedResourceDto<ITransaction>> => {
  try {
    const withValidStart =
      !status.includes(TransactionStatus.EXECUTED) && !status.includes(TransactionStatus.FAILED);
    const validStartTimestamp = new Date(Date.now() - 180 * 1_000).getTime();

    const { data } = await axios.get(
      `${serverUrl}/${controller}?page=${page}&size=${size}&filter=status:in:${status.join(',')}${withValidStart ? `&filter=validStart:gte:${validStartTimestamp}` : ''}`,
      {
        withCredentials: true,
      },
    );

    return data;
  } catch (error: any) {
    let message = 'Failed to get transactions';

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

/* Get the count of transactions for user with specific status */
export const execute = async (serverUrl: string, transactionId: number) => {
  try {
    const { data } = await axios.get(`${serverUrl}/${controller}/execute/${transactionId}`, {
      withCredentials: true,
    });

    return data;
  } catch (error: any) {
    let message = 'Failed to get transactions';

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
