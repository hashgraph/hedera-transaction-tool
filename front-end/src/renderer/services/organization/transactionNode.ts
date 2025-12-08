/* Get transaction nodes */
import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';
import {
  type ITransactionNode,
  TransactionNodeCollection,
} from '../../../../../middle-end/src/ITransactionNode';
import { BackEndTransactionType, TransactionStatus } from '@shared/interfaces';

export const getTransactionNodes = async (
  serverUrl: string,
  collection: TransactionNodeCollection,
  statusFilter: TransactionStatus[],
  transactionTypeFilter: BackEndTransactionType[],
): Promise<ITransactionNode[]> =>
  commonRequestHandler(async () => {
    const statusParam = statusFilter.length > 0 ? `&status=${statusFilter}` : '';
    const transactionTypeParam =
      transactionTypeFilter.length > 0 ? `&transactionType=${transactionTypeFilter}` : '';
    const { data } = await axiosWithCredentials.get(
      `${serverUrl}/transaction-nodes?collection=${collection}${statusParam}${transactionTypeParam}`,
    );

    return data;
  }, 'Failed to get transaction nodes');
