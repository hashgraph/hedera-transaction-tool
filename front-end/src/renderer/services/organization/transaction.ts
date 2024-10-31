import type { Organization } from '@prisma/client';
import type { LoggedInOrganization } from '@renderer/types';
import type {
  ITransaction,
  ITransactionFull,
  Network,
  PaginatedResourceDto,
} from '@main/shared/interfaces';
import type {
  ITransactionApprover,
  TransactionApproverDto,
} from '@main/shared/interfaces/organization/approvers';

import { Transaction } from '@hashgraph/sdk';

import { ObserverRole, TransactionStatus } from '@main/shared/interfaces';

import {
  axiosWithCredentials,
  commonRequestHandler,
  formatSignatureMap,
  getPrivateKey,
  getSignatureMapForPublicKeys,
} from '@renderer/utils';

import { decryptPrivateKey } from '../keyPairService';

const controller = 'transactions';

/* Submits a transaction to the back end */
export const submitTransaction = async (
  serverUrl: string,
  name: string,
  description: string,
  transactionBytes: string,
  network: Network,
  signature: string,
  creatorKeyId: number,
): Promise<{ id: number; transactionBytes: string }> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.post(`${serverUrl}/${controller}`, {
      name,
      description,
      transactionBytes,
      mirrorNetwork: network,
      signature,
      creatorKeyId,
    });

    return { id: data.id, transactionBytes: data.transactionBytes };
  }, 'Failed submit transaction');

/* Cancel a transaction  */
export const cancelTransaction = async (serverUrl: string, id: number): Promise<boolean> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.patch(`${serverUrl}/${controller}/cancel/${id}`);

    return data;
  }, `Failed cancel transaction with id ${id}`);

/* Decrypt, sign, upload signatures to the backend */
export const uploadSignatureMap = async (
  userId: string,
  userPassword: string | null,
  organization: LoggedInOrganization & Organization,
  publicKeys: string[],
  transaction: Transaction,
  transactionId: number,
) => {
  for (const publicKey of publicKeys) {
    const privateKeyRaw = await decryptPrivateKey(userId, userPassword, publicKey);
    const privateKey = getPrivateKey(publicKey, privateKeyRaw);
    await transaction.sign(privateKey);
  }

  const signatureMap = getSignatureMapForPublicKeys(publicKeys, transaction);

  await commonRequestHandler(async () => {
    await axiosWithCredentials.post(
      `${organization.serverUrl}/${controller}/${transactionId}/signers`,
      {
        signatureMap: formatSignatureMap(signatureMap),
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
    const filtering = `&filter=mirrorNetwork:eq:${network}`;

    const { data } = await axiosWithCredentials.get(
      `${serverUrl}/${controller}/sign?page=${page}&size=${size}${sorting}${filtering}`,
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
    const filtering = `&filter=mirrorNetwork:eq:${network}`;

    const { data } = await axiosWithCredentials.get(
      `${serverUrl}/${controller}/approve?page=${page}&size=${size}${sorting}${filtering}`,
    );

    return data;
  }, 'Failed to get transactions to approve');

/* Get transaction to approvers */
export const getTransactionApprovers = async (
  serverUrl: string,
  transactionId: number,
): Promise<ITransactionApprover[]> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.get(
      `${serverUrl}/${controller}/${transactionId}/approvers`,
    );

    return data;
  }, 'Failed to get transaction approvers');

/* Get if user should approve a transaction */
export const getUserShouldApprove = async (
  serverUrl: string,
  transactionId: number,
): Promise<boolean> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.get(
      `${serverUrl}/${controller}/approve/${transactionId}`,
    );

    return data;
  }, 'Failed to get if user should approve the transaction');

/* Get the count of the transactions to sign */
export const getTransactionById = async (
  serverUrl: string,
  id: number,
): Promise<ITransactionFull> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.get(`${serverUrl}/${controller}/${id}`, {
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

    const filtering = `&filter=status:in:${status.join(',')}${withValidStart ? `&filter=validStart:gte:${validStartTimestamp}` : ''}&filter=mirrorNetwork:eq:${network}`;
    const sorting = (sort || []).map(s => `&sort=${s.property}:${s.direction}`).join('');

    const { data } = await axiosWithCredentials.get(
      `${serverUrl}/${controller}?page=${page}&size=${size}${filtering}${sorting}`,
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

    const { data } = await axiosWithCredentials.get(
      `${serverUrl}/${controller}/history?page=${page}&size=${size}${sorting}${filtering}`,
    );

    return data;
  }, 'Failed to get history transactions');

/* Adds observers */
export const addObservers = async (serverUrl: string, transactionId: number, userIds: number[]) =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.post(
      `${serverUrl}/${controller}/${transactionId}/observers`,
      {
        userIds,
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
    const { data } = await axiosWithCredentials.delete(
      `${serverUrl}/${controller}/${transactionId}/observers/${observerId}`,
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
    const { data } = await axiosWithCredentials.patch(
      `${serverUrl}/${controller}/${transactionId}/observers/${observerId}`,
      {
        role,
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
    const { data } = await axiosWithCredentials.post(
      `${serverUrl}/${controller}/${transactionId}/approvers`,
      {
        approversArray: approvers,
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
    const { data } = await axiosWithCredentials.delete(
      `${serverUrl}/${controller}/${transactionId}/approvers/${approverId}`,
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
    const { data } = await axiosWithCredentials.post(
      `${serverUrl}/${controller}/${transactionId}/approvers/approve`,
      {
        userKeyId: userKeyId,
        signature: signature,
        approved: approved,
      },
    );

    return data;
  }, 'Failed to send approve choice');
