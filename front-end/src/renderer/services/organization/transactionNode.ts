/* Get transaction nodes */
import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';
import {
  type ITransactionNode,
  TransactionNodeCollection,
} from '../../../../../middle-end/src/ITransactionNode';
import { BackEndTransactionType, type Network, TransactionStatus } from '@shared/interfaces';

export const getTransactionNodes = async (
  serverUrl: string,
  collection: TransactionNodeCollection,
  network: Network,
  statusFilter: TransactionStatus[],
  transactionTypeFilter: BackEndTransactionType[],
): Promise<ITransactionNode[]> =>
  commonRequestHandler(async () => {
    type Params = {
      collection: string;
      network: string;
      status?: string;
      transactionType?: string;
    };
    const params: Params = { collection, network };
    if (statusFilter.length > 0) {
      params.status = `${statusFilter}`;
    }
    if (transactionTypeFilter.length > 0) {
      params.transactionType = `${transactionTypeFilter}`;
    }
    const r = await axiosWithCredentials.get(`${serverUrl}/transaction-nodes`, { params });

    return r.data;
  }, 'Failed to get transaction nodes');
