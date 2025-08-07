import { KeyList, Transaction as SDKTransaction } from '@hashgraph/sdk';

import TransactionFactory from '@app/common/models/transaction-factory';
import { MirrorNodeService } from '@app/common/mirror-node';

/* Gets the keys and potential accounts that are required to sign the transaction */
export const computeSignatureKey = async (
  transaction: SDKTransaction,
  mirrorNodeService: MirrorNodeService,
  mirrorNetwork: string,
): Promise<KeyList> => {
  const transactionModel = TransactionFactory.fromTransaction(transaction);

  return await transactionModel.computeSignatureKey(mirrorNodeService, mirrorNetwork);
};
