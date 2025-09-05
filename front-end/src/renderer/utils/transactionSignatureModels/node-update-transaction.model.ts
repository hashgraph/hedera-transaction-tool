import { NodeUpdateTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class NodeUpdateTransactionModel extends TransactionBaseModel<NodeUpdateTransaction> {
  getNewKeys() {
    if (this.transaction.adminKey != null) {
      return [this.transaction.adminKey];
    }

    return [];
  }

  getNodeId(): number | null {
    if (this.transaction.nodeId) {
      return this.transaction.nodeId.toNumber();
    }
    return null;
  }
}
