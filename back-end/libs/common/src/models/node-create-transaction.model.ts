import { NodeCreateTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction-base.model';
import TransactionFactory from './transaction-factory';

export default class NodeCreateTransactionModel
  extends TransactionBaseModel<NodeCreateTransaction> {

  static readonly TRANSACTION_TYPE = 'NodeCreateTransaction';

  getNewKeys() {
    if (this.transaction.adminKey != null) {
      return [this.transaction.adminKey];
    }

    return [];
  }
}

TransactionFactory.register(
  NodeCreateTransactionModel.TRANSACTION_TYPE,
  NodeCreateTransactionModel
);
