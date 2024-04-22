import axios, { AxiosError } from 'axios';

import { Transaction } from '@hashgraph/sdk';
import { Organization } from '@prisma/client';

import { LoggedInOrganization, LoggedInUserWithPassword } from '@renderer/types';

import { getPrivateKey, getSignatures } from '@renderer/utils';
import { ITransaction, ITransactionFull } from '@main/shared/interfaces';

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
  for (const publicKey of publicKeys) {
    const privateKeyRaw = await decryptPrivateKey(user.id, user.password, publicKey);
    const privateKey = getPrivateKey(publicKey, privateKeyRaw);

    const signatures = await getSignatures(privateKey, transaction);

    /* Upload the signature */
    await uploadSignature(
      organization.serverUrl,
      transactionId,
      organization.userKeys.find(k => k.publicKey === publicKey)?.id || -1,
      signatures,
    );
  }
};

/* Get transactions to sign */
export const getTransactionsToSign = async (
  serverUrl: string,
  skip: number,
  take: number,
): Promise<
  {
    transaction: ITransaction;
    keysToSign: number[];
  }[]
> => {
  try {
    const { data } = await axios.get(`${serverUrl}/${controller}/sign?skip=${skip}&take=${take}`, {
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
export const getTransactionsToSignCount = async (serverUrl: string): Promise<number> => {
  try {
    const { data } = await axios.get(`${serverUrl}/${controller}/sign/count`, {
      withCredentials: true,
    });

    return Number(data);
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
