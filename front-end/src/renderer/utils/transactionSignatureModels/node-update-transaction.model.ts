import { NodeUpdateTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class NodeUpdateTransactionModel extends TransactionBaseModel<NodeUpdateTransaction> {
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
