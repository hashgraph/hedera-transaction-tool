import type { ITransaction } from '@shared/interfaces';
import axios from 'axios';
import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';
import { cancelTransaction } from './transaction';
import { cancelGroupFallback } from './cancelGroupFallback';
import type { Organization } from '@prisma/client';

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
  organization: Organization,
  description: string,
  atomic: boolean,
  sequential: boolean,
  groupItems: ApiGroupItem[],
): Promise<{ id: number; transactionBytes: string }> => {
  return commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.post(
      organization,
      `transaction-groups`,
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

/* Cancel all transactions in a group */
export enum CancelFailureCode {
  NOT_CANCELABLE = 'NOT_CANCELABLE',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface CancelGroupResult {
  canceled: number[];
  alreadyCanceled: number[];
  failed: {
    id: number;
    code: CancelFailureCode;
    message: string;
  }[];
  summary: {
    processedCount: number;
    canceled: number;
    alreadyCanceled: number;
    failed: number;
  };
}

export const cancelTransactionGroup = async (
  organization: Organization,
  groupId: number,
  groupItems: IGroupItem[],
): Promise<CancelGroupResult> => {
  return commonRequestHandler(async () => {
    try {
      const { data } = await axiosWithCredentials.patch<CancelGroupResult>(
        organization,
        `transaction-groups/${groupId}/cancel`,
        undefined,
        { withCredentials: true },
      );
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return cancelGroupFallback(organization, groupItems, cancelTransaction);
      }
      // Let commonRequestHandler handle non-404 errors and map them consistently.
      throw error;
    }
  }, 'Failed to cancel transactions in group');
};

/* Get transaction groups */
export const getTransactionGroupById = async (org: Organization, id: number, full?: boolean) => {
  return commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.get<IGroup>(org, `transaction-groups/${id}`, {
      withCredentials: true,
      params: full !== undefined ? { full } : undefined,
    });

    return data;
  }, 'Failed to get transaction groups');
};
