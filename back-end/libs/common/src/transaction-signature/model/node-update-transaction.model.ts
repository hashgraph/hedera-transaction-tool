import { NodeUpdateTransaction } from '@hiero-ledger/sdk';

import { TransactionBaseModel } from './transaction-base.model';

export class NodeUpdateTransactionModel
  extends TransactionBaseModel<NodeUpdateTransaction> {

  static readonly TRANSACTION_TYPE = 'NodeUpdateTransaction';

  override getNewKeys() {
    if (this.transaction.adminKey != null) {
      return [this.transaction.adminKey];
    }

    return [];
  }

  override getNodeId(): number | null {
    if (this.transaction.nodeId) {
      return this.transaction.nodeId.toNumber();
    }
    return null;
  }
}
