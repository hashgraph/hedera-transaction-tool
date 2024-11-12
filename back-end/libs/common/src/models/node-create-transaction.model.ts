import { NodeCreateTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class NodeCreateTransactionModel extends TransactionBaseModel<NodeCreateTransaction> {
  getNewKeys() {
    if (this.transaction.adminKey != null) {
      return [this.transaction.adminKey];
    }

    return [];
  }
}
