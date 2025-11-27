/* Get transaction nodes */
import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';
import {
  type ITransactionNode,
  TransactionNodeCollection,
} from '../../../../../middle-end/src/ITransactionNode';

export const getTransactionNodes = async (
  serverUrl: string,
  collection: TransactionNodeCollection,
): Promise<ITransactionNode[]> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.get(
      `${serverUrl}/transaction-nodes?collection=${collection}`,
    );

    return data;
  }, 'Failed to get transaction nodes');
