import axios, { AxiosError } from 'axios';

import { Transaction } from '@hashgraph/sdk';
import { Organization } from '@prisma/client';

import { LoggedInOrganization, LoggedInUserWithPassword } from '@renderer/types';

import {
  ITransaction,
  ITransactionFull,
  ObserverRole,
  PaginatedResourceDto,
  TransactionStatus,
} from '@main/shared/interfaces';
import {
  ITransactionApprover,
  TransactionApproverDto,
} from '@main/shared/interfaces/organization/approvers';

import { decryptPrivateKey } from '../keyPairService';

import { getPrivateKey, getSignatures } from '@renderer/utils';

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
  sort?: { property: string; direction: 'asc' | 'desc' }[],
): Promise<
  PaginatedResourceDto<{
    transaction: ITransaction;
    keysToSign: number[];
  }>
> => {
  try {
    const sorting = (sort || []).map(s => `&sort=${s.property}:${s.direction}`).join('');

    const { data } = await axios.get(
      `${serverUrl}/${controller}/sign?page=${page}&size=${size}${sorting}`,
      {
        withCredentials: true,
      },
    );

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

/* Get transactions to approve */
export const getTransactionsToApprove = async (
  serverUrl: string,
  page: number,
  size: number,
  sort?: { property: string; direction: 'asc' | 'desc' }[],
): Promise<PaginatedResourceDto<ITransaction>> => {
  try {
    const sorting = (sort || []).map(s => `&sort=${s.property}:${s.direction}`).join('');

    const { data } = await axios.get(
      `${serverUrl}/${controller}/approve?page=${page}&size=${size}${sorting}`,
      {
        withCredentials: true,
      },
    );

    return data;
  } catch (error: any) {
    let message = 'Failed to get transactions to approve';

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

/* Get transaction to approvers */
export const getTransactionApprovers = async (
  serverUrl: string,
  transactionId: number,
): Promise<ITransactionApprover[]> => {
  try {
    const { data } = await axios.get(`${serverUrl}/${controller}/${transactionId}/approvers`, {
      withCredentials: true,
    });

    return data;
  } catch (error: any) {
    let message = 'Failed to get transaction approvers';

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
  sort?: { property: string; direction: 'asc' | 'desc' }[],
): Promise<PaginatedResourceDto<ITransaction>> => {
  try {
    const withValidStart =
      !status.includes(TransactionStatus.EXECUTED) && !status.includes(TransactionStatus.FAILED);
    const validStartTimestamp = new Date(Date.now() - 180 * 1_000).getTime();

    const filtering = `&filter=status:in:${status.join(',')}${withValidStart ? `&filter=validStart:gte:${validStartTimestamp}` : ''}`;
    const sorting = (sort || []).map(s => `&sort=${s.property}:${s.direction}`).join('');

    const { data } = await axios.get(
      `${serverUrl}/${controller}?page=${page}&size=${size}${filtering}${sorting}`,
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

/* Adds observers */
export const addObservers = async (serverUrl: string, transactionId: number, userIds: number[]) => {
  try {
    const { data } = await axios.post(
      `${serverUrl}/${controller}/${transactionId}/observers`,
      {
        userIds,
      },
      {
        withCredentials: true,
      },
    );

    return data;
  } catch (error: any) {
    let message = 'Failed to add obsersers to transaction';

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

/* Removes an observer */
export const removeObserver = async (
  serverUrl: string,
  transactionId: number,
  observerId: number,
) => {
  try {
    const { data } = await axios.delete(
      `${serverUrl}/${controller}/${transactionId}/observers/${observerId}`,
      {
        withCredentials: true,
      },
    );

    return data;
  } catch (error: any) {
    let message = 'Failed to remove obserser';

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

/* Updates an observer */
export const updateObserverRole = async (
  serverUrl: string,
  transactionId: number,
  observerId: number,
  role: ObserverRole,
) => {
  try {
    const { data } = await axios.patch(
      `${serverUrl}/${controller}/${transactionId}/observers/${observerId}`,
      {
        role,
      },
      {
        withCredentials: true,
      },
    );

    return data;
  } catch (error: any) {
    let message = "Failed to update obserser's role";

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

/* Adds approvers */
export const addApprovers = async (
  serverUrl: string,
  transactionId: number,
  approvers: TransactionApproverDto[],
) => {
  try {
    const { data } = await axios.post(
      `${serverUrl}/${controller}/${transactionId}/approvers`,
      {
        approversArray: approvers,
      },
      {
        withCredentials: true,
      },
    );

    return data;
  } catch (error: any) {
    let message = 'Failed to add approvers to transaction';

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

/* Removes an approver */
export const removeApprover = async (
  serverUrl: string,
  transactionId: number,
  approverId: number,
) => {
  try {
    const { data } = await axios.delete(
      `${serverUrl}/${controller}/${transactionId}/approvers/${approverId}`,
      {
        withCredentials: true,
      },
    );

    return data;
  } catch (error: any) {
    let message = 'Failed to remove approver';

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

/* Sends approver's choice */
export const sendApproverChoice = async (
  serverUrl: string,
  transactionId: number,
  userKeyId: number,
  signature: string,
  approved: boolean,
) => {
  try {
    const { data } = await axios.post(
      `${serverUrl}/${controller}/${transactionId}/approvers/approve`,
      {
        userKeyId: userKeyId,
        signature: signature,
        approved: approved,
      },
      {
        withCredentials: true,
      },
    );

    return data;
  } catch (error: any) {
    let message = 'Failed to send approve choice';

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
