import type { Organization } from '@prisma/client';
import type { TransactionId } from '@hiero-ledger/sdk';
import { Transaction as SDKTransaction } from '@hiero-ledger/sdk';
import type { LoggedInOrganization, SignatureItem } from '@renderer/types';
import type {
  ISignatureImport,
  ITransaction,
  ITransactionFull,
  Network,
  PaginatedResourceDto,
  SignatureImportResultDto,
  TransactionApproverDto,
} from '@shared/interfaces';
import { SignerTool } from '@shared/interfaces';

import {
  axiosWithCredentials,
  commonRequestHandler,
  formatSignatureMap,
  type FormattedMap,
  getPrivateKey,
  getSignatureMapForPublicKeys,
} from '@renderer/utils';

import { decryptPrivateKey } from '../keyPairService';

const controller = 'transactions';

/* Submits a transaction to the back end */
export const submitTransaction = async (
  organization: Organization,
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
    const { data } = await axiosWithCredentials.post(organization, `${controller}`, {
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
export const cancelTransaction = async (organization: Organization, id: number): Promise<boolean> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.patch(organization, `${controller}/cancel/${id}`);

    return data;
  }, `Failed to cancel transaction with id ${id}`);

/* Archive a transaction  */
export const archiveTransaction = async (
  organization: Organization,
  id: number,
): Promise<boolean> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.patch(organization, `${controller}/archive/${id}`);

    return data;
  }, `Failed to archive transaction with id ${id}`);

/* Executes the manual transaction  */
export const executeTransaction = async (
  organization: Organization,
  id: number,
): Promise<boolean> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.patch(organization, `${controller}/execute/${id}`);

    return data;
  }, `Failed to execute transaction with id ${id}`);

/* Decrypt, sign, upload signatures to the backend */
export const uploadSignatures = async (
  userId: string,
  userPassword: string | null,
  organization: LoggedInOrganization & Organization,
  publicKeys?: string[],
  transaction?: SDKTransaction,
  transactionId?: number,
  items?: SignatureItem[],
) => {
  const formattedMaps: { id: number; signatureMap: FormattedMap; tool: string }[] = [];

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
      id: transactionId,
      signatureMap: formatSignatureMap(signatureMap),
      tool: SignerTool.V2,
    });
  }

  return await commonRequestHandler(async () => {
    return await axiosWithCredentials.post(
      organization,
      `${controller}/signers?includeNotifications=true`,
      formattedMaps,
    );
  }, 'Failed upload signatures');
};

/**
 * Imports signatures for a transaction.
 *
 * @param organization
 * @param signatureImport
 */
export const importSignatures = async (
  organization: LoggedInOrganization & Organization,
  signatureImport: ISignatureImport[] | ISignatureImport,
): Promise<SignatureImportResultDto[]> => {
  const formattedMaps: { id: number; signatureMap: FormattedMap; tool?: string }[] = [];
  const imports = Array.isArray(signatureImport) ? signatureImport : [signatureImport];
  for (const si of imports) {
    formattedMaps.push({
      id: si.id,
      signatureMap: formatSignatureMap(si.signatureMap),
      tool: si.tool,
    });
  }
  return commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.post(
      organization,
      `${controller}/signatures/import`,
      formattedMaps,
    );
    return data;
  }, 'Failed to import signatures');
};

/* Get if user should approve a transaction */
export const getUserShouldApprove = async (
  _serverUrl: string,
  _transactionId: number,
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
  organization: Organization,
  id: number | TransactionId,
): Promise<ITransactionFull> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.get(
      organization,
      `${controller}/${id.toString()}`,
      {
        withCredentials: true,
      },
    );

    return data;
  }, `Failed to get transaction with id ${id}`);

/* Get history transactions */
export const getHistoryTransactions = async (
  organization: Organization,
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
      organization,
      `${controller}/history?page=${page}&size=${size}${sorting}${filtering}`,
    );

    return data;
  }, 'Failed to get history transactions');

/* Adds observers */
export const addObservers = async (
  organization: Organization,
  transactionId: number,
  userIds: number[],
) =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.post(
      organization, `${controller}/${transactionId}/observers`,
      {
        userIds,
      },
    );

    return data;
  }, 'Failed to add observers to transaction');

/* Adds approvers */
export const addApprovers = async (
  organization: Organization,
  transactionId: number,
  approvers: TransactionApproverDto[],
) =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.post(
      organization,
      `${controller}/${transactionId}/approvers`,
      {
        approversArray: approvers,
      },
    );

    return data;
  }, 'Failed to add approvers to transaction');

/* Sends approver's choice */
export const sendApproverChoice = async (
  organization: Organization,
  transactionId: number,
  userKeyId: number,
  signature: string,
  approved: boolean,
) =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.post(
      organization,
      `${controller}/${transactionId}/approvers/approve`,
      {
        userKeyId: userKeyId,
        signature: signature,
        approved: approved,
      },
    );

    return data;
  }, 'Failed to send approve choice');
