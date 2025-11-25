/* Get transaction nodes */
import type { PaginatedResourceDto } from '@shared/interfaces';
import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';
import {
  type ITransactionNode,
  TransactionNodeCollection,
} from '../../../../../middle-end/src/ITransactionNode';

export const getTransactionNodes = async (
  serverUrl: string,
  collection: TransactionNodeCollection,
  page: number,
  size: number,
  sort?: { property: string; direction: 'asc' | 'desc' }[],
): Promise<PaginatedResourceDto<ITransactionNode>> =>
  commonRequestHandler(async () => {
    const sorting = (sort || []).map(s => `&sort=${s.property}:${s.direction}`).join('');

    const { data } = await axiosWithCredentials.get(
      `${serverUrl}/transaction-nodes?collection=${collection}&page=${page}&size=${size}${sorting}`,
    );

    return data;
  }, 'Failed to get transation nodes');
