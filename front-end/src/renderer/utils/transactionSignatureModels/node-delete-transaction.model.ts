import { NodeDeleteTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class NodeDeleteTransactionModel extends TransactionBaseModel<NodeDeleteTransaction> {
  getNodeId(): number | null {
    // if fee payer is council_accounts,
    // it will already be added to the required list
    // and the admin key is not required
    // otherwise, admin key is required
    const payerId = this.transaction.transactionId?.accountId;
    const isCouncilAccount = payerId && payerId.toString() in COUNCIL_ACCOUNTS;
    if (!isCouncilAccount && this.transaction.nodeId) {
      return this.transaction.nodeId.toNumber();
    }
    return null;
  }
}
