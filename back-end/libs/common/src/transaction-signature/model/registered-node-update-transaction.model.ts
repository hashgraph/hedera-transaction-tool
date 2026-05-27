import { RegisteredNodeUpdateTransaction } from '@hiero-ledger/sdk';

import { TransactionBaseModel } from './transaction-base.model';

export class RegisteredNodeUpdateTransactionModel extends TransactionBaseModel<RegisteredNodeUpdateTransaction> {
  static readonly TRANSACTION_TYPE = 'RegisteredNodeUpdateTransaction';

  getNewKeys() {
    if (this.transaction.adminKey != null) {
      return [this.transaction.adminKey];
    }

    return [];
  }

  getRegisteredNodeId(): number | null {
    if (this.transaction.registeredNodeId != null) {
      return this.transaction.registeredNodeId.toNumber();
    }
    return null;
  }
}
