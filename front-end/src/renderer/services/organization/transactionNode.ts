/* Get transaction nodes */
import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';
import {
  type ITransactionNode,
  TransactionNodeCollection,
} from '../../../../../shared/src/ITransactionNode';
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
  },
    'Something went wrong while fetching transaction nodes. Please try again.',
    'Your session may have expired. Try refreshing the page and signing in again.',
    {
      404: `Could not retrieve transactions. The server may be outdated — please contact your administrator for help.`,
      403: `You don't have permission to view transactions for this network.`,
      500: `The server ran into a problem fetching transactions. Try again in a moment.`,
    },
  );
