import { NodeUpdateTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class NodeUpdateTransactionModel extends TransactionBaseModel<NodeUpdateTransaction> {
  getNewKeys() {
    if (this.transaction.adminKey != null) {
      return [this.transaction.adminKey];
    }

    return [];
  }

  getSigningAccounts(): Set<string> {
    const set = super.getSigningAccounts();

    if (this.transaction.accountId != null) {
      set.add(this.transaction.accountId.toString());
    }

    return set;
  }
}
