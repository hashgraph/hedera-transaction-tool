import axios from 'axios';

import { Transaction } from '@hashgraph/sdk';

import { Organization } from '@prisma/client';

import { Network } from '@main/shared/enums';

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

import { commonRequestHandler, getPrivateKey, getSignatures } from '@renderer/utils';

const controller = 'transactions';

/* Submits a transaction to the back end */
export const submitTransaction = async (
  serverUrl: string,
  name: string,
  description: string,
  body: string,
  network: Network,
  signature: string,
  creatorKeyId: number,
): Promise<{ id: number; body: string }> =>
  commonRequestHandler(async () => {
    const { data } = await axios.post(
      `${serverUrl}/${controller}`,
      {
        name,
        description,
        body,
        network,
        signature,
        creatorKeyId,
      },
      {
        withCredentials: true,
      },
    );

    return { id: data.id, body: data.body };
  }, 'Failed submit transaction');

/* Uploads signatures to the back end */
export const uploadSignature = async (
  serverUrl: string,
  transactionId: number,
  publicKeyId: number,
  signatures: { [key: string]: string },
): Promise<void> =>
  commonRequestHandler(async () => {
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
  }, 'Failed upload signature');

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

  await commonRequestHandler(async () => {
    await axios.post(
      `${organization.serverUrl}/${controller}/${transactionId}/signers/many`,
      {
        signatures: signaturesArray,
      },
      {
        withCredentials: true,
      },
    );
  }, 'Failed upload signatures');
};

/* Get transactions to sign */
export const getTransactionsToSign = async (
  serverUrl: string,
  network: Network,
  page: number,
  size: number,
  sort?: { property: string; direction: 'asc' | 'desc' }[],
): Promise<
  PaginatedResourceDto<{
    transaction: ITransaction;
    keysToSign: number[];
  }>
> =>
  commonRequestHandler(async () => {
    const sorting = (sort || []).map(s => `&sort=${s.property}:${s.direction}`).join('');
    const filtering = `&filter=network:eq:${network}`;

    const { data } = await axios.get(
      `${serverUrl}/${controller}/sign?page=${page}&size=${size}${sorting}${filtering}`,
      {
        withCredentials: true,
      },
    );

    return data;
  }, 'Failed to get transactions to sign');

/* Get transactions to approve */
export const getTransactionsToApprove = async (
  serverUrl: string,
  network: Network,
  page: number,
  size: number,
  sort?: { property: string; direction: 'asc' | 'desc' }[],
): Promise<PaginatedResourceDto<ITransaction>> =>
  commonRequestHandler(async () => {
    const sorting = (sort || []).map(s => `&sort=${s.property}:${s.direction}`).join('');
    const filtering = `&filter=network:eq:${network}`;

    const { data } = await axios.get(
      `${serverUrl}/${controller}/approve?page=${page}&size=${size}${sorting}${filtering}`,
      {
        withCredentials: true,
      },
    );

    return data;
  }, 'Failed to get transactions to approve');

/* Get transaction to approvers */
export const getTransactionApprovers = async (
  serverUrl: string,
  transactionId: number,
): Promise<ITransactionApprover[]> =>
  commonRequestHandler(async () => {
    const { data } = await axios.get(`${serverUrl}/${controller}/${transactionId}/approvers`, {
      withCredentials: true,
    });

    return data;
  }, 'Failed to get transaction approvers');

/* Get if user should approve a transaction */
export const getUserShouldApprove = async (
  serverUrl: string,
  transactionId: number,
): Promise<boolean> =>
  commonRequestHandler(async () => {
    const { data } = await axios.get(`${serverUrl}/${controller}/approve/${transactionId}`, {
      withCredentials: true,
    });

    return data;
  }, 'Failed to get if user should approve the transaction');

/* Get the count of the transactions to sign */
export const getTransactionById = async (
  serverUrl: string,
  id: number,
): Promise<ITransactionFull> =>
  commonRequestHandler(async () => {
    const { data } = await axios.get(`${serverUrl}/${controller}/${id}`, {
      withCredentials: true,
    });

    return data;
  }, `Failed to get transaction with id ${id}`);

/* Get transactions for user with specific status */
export const getTransactionsForUser = async (
  serverUrl: string,
  status: TransactionStatus[],
  network: Network,
  page: number,
  size: number,
  sort?: { property: string; direction: 'asc' | 'desc' }[],
): Promise<PaginatedResourceDto<ITransaction>> =>
  commonRequestHandler(async () => {
    const withValidStart =
      !status.includes(TransactionStatus.EXECUTED) &&
      !status.includes(TransactionStatus.FAILED) &&
      !status.includes(TransactionStatus.EXPIRED) &&
      !status.includes(TransactionStatus.CANCELED);
    const validStartTimestamp = new Date(Date.now() - 180 * 1_000).getTime();

    const filtering = `&filter=status:in:${status.join(',')}${withValidStart ? `&filter=validStart:gte:${validStartTimestamp}` : ''}&filter=network:eq:${network}`;
    const sorting = (sort || []).map(s => `&sort=${s.property}:${s.direction}`).join('');

    const { data } = await axios.get(
      `${serverUrl}/${controller}?page=${page}&size=${size}${filtering}${sorting}`,
      {
        withCredentials: true,
      },
    );

    return data;
  }, 'Failed to get transactions for user');

/* Get history transactions */
export const getHistoryTransactions = async (
  serverUrl: string,
  page: number,
  size: number,
  filter: {
    property: keyof ITransaction;
    rule: string;
    value: string | string[];
  }[],
  sort?: { property: string; direction: 'asc' | 'desc' }[],
): Promise<PaginatedResourceDto<ITransaction>> =>
  commonRequestHandler(async () => {
    const sorting = (sort || []).map(s => `&sort=${s.property}:${s.direction}`).join('');
    const filtering = filter.map(f => `&filter=${f.property}:${f.rule}:${f.value}`).join('');

    const { data } = await axios.get(
      `${serverUrl}/${controller}/history?page=${page}&size=${size}${sorting}${filtering}`,
      {
        withCredentials: true,
      },
    );

    return data;
  }, 'Failed to get history transactions');

/* Adds observers */
export const addObservers = async (serverUrl: string, transactionId: number, userIds: number[]) =>
  commonRequestHandler(async () => {
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
  }, 'Failed to add observers to transaction');

/* Removes an observer */
export const removeObserver = async (
  serverUrl: string,
  transactionId: number,
  observerId: number,
) =>
  commonRequestHandler(async () => {
    const { data } = await axios.delete(
      `${serverUrl}/${controller}/${transactionId}/observers/${observerId}`,
      {
        withCredentials: true,
      },
    );

    return data;
  }, 'Failed to remove observer');

/* Updates an observer */
export const updateObserverRole = async (
  serverUrl: string,
  transactionId: number,
  observerId: number,
  role: ObserverRole,
) =>
  commonRequestHandler(async () => {
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
  }, 'Failed to update observer role');

/* Adds approvers */
export const addApprovers = async (
  serverUrl: string,
  transactionId: number,
  approvers: TransactionApproverDto[],
) =>
  commonRequestHandler(async () => {
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
  }, 'Failed to add approvers to transaction');

/* Removes an approver */
export const removeApprover = async (
  serverUrl: string,
  transactionId: number,
  approverId: number,
) =>
  commonRequestHandler(async () => {
    const { data } = await axios.delete(
      `${serverUrl}/${controller}/${transactionId}/approvers/${approverId}`,
      {
        withCredentials: true,
      },
    );

    return data;
  }, 'Failed to remove approver');

/* Sends approver's choice */
export const sendApproverChoice = async (
  serverUrl: string,
  transactionId: number,
  userKeyId: number,
  signature: string,
  approved: boolean,
) =>
  commonRequestHandler(async () => {
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
  }, 'Failed to send approve choice');
