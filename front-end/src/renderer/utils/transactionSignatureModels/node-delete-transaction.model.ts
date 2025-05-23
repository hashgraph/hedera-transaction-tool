import { NodeDeleteTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class NodeDeleteTransactionModel extends TransactionBaseModel<NodeDeleteTransaction> {
  getNodeId(): number | null {
    if (this.transaction.nodeId) {
      return this.transaction.nodeId.toNumber();
    }
    return null;
  }
}
