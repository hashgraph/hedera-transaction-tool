import type { Organization } from '@prisma/client';
import type { LoggedInOrganization, SignatureItem } from '@renderer/types';
import type {
  ITransaction,
  ITransactionFull,
  Network,
  PaginatedResourceDto,
} from '@shared/interfaces';
import type { ITransactionApprover, TransactionApproverDto } from '@shared/interfaces';

import { Transaction } from '@hashgraph/sdk';

import { ObserverRole, TransactionStatus } from '@shared/interfaces';

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
  isManual?: boolean,
  reminderMillisecondsBefore?: number | null,
): Promise<{ id: number; transactionBytes: string }> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.post(`${serverUrl}/${controller}`, {
      name,
      description,
      transactionBytes,
      mirrorNetwork: network,
      signature,
      creatorKeyId,
      isManual,
      reminderMillisecondsBefore: reminderMillisecondsBefore || undefined,
    });

    return { id: data.id, transactionBytes: data.transactionBytes };
  }, 'Failed submit transaction');

/* Cancel a transaction  */
export const cancelTransaction = async (serverUrl: string, id: number): Promise<boolean> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.patch(`${serverUrl}/${controller}/cancel/${id}`);

    return data;
  }, `Failed to cancel transaction with id ${id}`);

/* Archive a transaction  */
export const archiveTransaction = async (serverUrl: string, id: number): Promise<boolean> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.patch(`${serverUrl}/${controller}/archive/${id}`);

    return data;
  }, `Failed to archive transaction with id ${id}`);

/* Executes the manual transaction  */
export const executeTransaction = async (serverUrl: string, id: number): Promise<boolean> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.patch(`${serverUrl}/${controller}/execute/${id}`);

    return data;
  }, `Failed to execute transaction with id ${id}`);

/* Decrypt, sign, upload signatures to the backend */
export const uploadSignatures = async (
  userId: string,
  userPassword: string | null,
  organization: LoggedInOrganization & Organization,
  publicKeys?: string[],
  transaction?: Transaction,
  transactionId?: number,
  items?: SignatureItem[],
) => {
  const formattedMaps = [];

  if (!items) {
    if (!publicKeys || !transaction || !transactionId) {
      throw new Error('Invalid parameters');
    }

    items = [
      {
        publicKeys,
        transaction,
        transactionId,
      },
    ];
  }

  for (const { publicKeys, transaction, transactionId } of items) {
    for (const publicKey of publicKeys) {
      const privateKeyRaw = await decryptPrivateKey(userId, userPassword, publicKey);
      const privateKey = getPrivateKey(publicKey, privateKeyRaw);
      await transaction.sign(privateKey);
    }

    const signatureMap = getSignatureMapForPublicKeys(publicKeys, transaction);
    formattedMaps.push({
      transactionId: transactionId,
      signatureMap: formatSignatureMap(signatureMap),
    });
  }

  await commonRequestHandler(async () => {
    await axiosWithCredentials.post(
      `${organization.serverUrl}/${controller}/signers`,
      formattedMaps,
    );
  }, 'Failed upload signatures');
};

/* Import signatures from TTv1 */
export const importSignatures = async (
  serverUrl: string,
  transactionId: number, // Backend transaction id
  signatureMap: Record<string, Record<string, Record<string, string>>>,
  // node account id / transactionId / publicKey => signature
): Promise<{transactionId: number, error?: string }> => {
  return await commonRequestHandler(async () => {
    return await axiosWithCredentials.post(
      `${serverUrl}/import/signatures`,
      {transactionId, signatureMap},
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
  serverUrl: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  transactionId: number, // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<boolean> =>
  commonRequestHandler(async () => {
    //TODO Approve is not implemented yet, and doing it this way is not correct
    // as it will request the backend for every transaction, in the case of TransactionGroupDetails.vue
    // where the group is large, this is a problem. The approval status should be pulled initially for all
    // transactions.

    // const { data } = await axiosWithCredentials.get(
    //   `${serverUrl}/${controller}/approve/${transactionId}`,
    // );
    //
    // return data;

    return false;
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
    const filtering = `&filter=status:in:${status.join(',')}&filter=mirrorNetwork:eq:${network}`;
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
