import { Transaction } from '@hashgraph/sdk';

import TransactionFactory from '@app/common/models/transaction-factory';

/* Gets the keys and potential accounts that are required to sign the transaction */
export const getSignatureEntities = (transaction: Transaction) => {
  try {
    const transactionModel = TransactionFactory.fromTransaction(transaction);

    const result = {
      accounts: [...transactionModel.getSigningAccounts()],
      receiverAccounts: [...transactionModel.getReceiverAccounts()],
      newKeys: [...transactionModel.getNewKeys()],
      nodeId: transactionModel.getNodeId(),
    };

    return result;
  } catch (err) {
    console.log(err);
    return {
      accounts: [],
      receiverAccounts: [],
      newKeys: [],
      nodeId: null,
    };
  }
};
