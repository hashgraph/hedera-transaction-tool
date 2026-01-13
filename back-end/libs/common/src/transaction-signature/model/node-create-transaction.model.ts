import { NodeCreateTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction-base.model';

export class NodeCreateTransactionModel
  extends TransactionBaseModel<NodeCreateTransaction> {

  static readonly TRANSACTION_TYPE = 'NodeCreateTransaction';

  getNewKeys() {
    if (this.transaction.adminKey != null) {
      return [this.transaction.adminKey];
    }

    return [];
  }
}
