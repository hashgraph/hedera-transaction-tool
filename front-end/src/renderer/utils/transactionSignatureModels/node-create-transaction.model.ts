import { NodeCreateTransaction } from '@hiero-ledger/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class NodeCreateTransactionModel extends TransactionBaseModel<NodeCreateTransaction> {
  override getNewKeys() {
    if (this.transaction.adminKey != null) {
      return [this.transaction.adminKey];
    }

    return [];
  }
}
