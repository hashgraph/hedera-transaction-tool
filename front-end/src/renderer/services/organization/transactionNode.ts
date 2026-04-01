/* Get transaction nodes */
import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';
import {
  type ITransactionNode,
  TransactionNodeCollection,
} from '../../../../../shared/src/ITransactionNode';
import { BackEndTransactionType, type Network, TransactionStatus } from '@shared/interfaces';
import {
  TRANSACTION_NODE_DEFAULT_MESSAGE,
  TRANSACTION_NODE_STATUS_MESSAGES,
  SESSION_EXPIRED_MESSAGE,
} from './errorMessages';

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
    TRANSACTION_NODE_DEFAULT_MESSAGE,
    SESSION_EXPIRED_MESSAGE,
    TRANSACTION_NODE_STATUS_MESSAGES,
  );
