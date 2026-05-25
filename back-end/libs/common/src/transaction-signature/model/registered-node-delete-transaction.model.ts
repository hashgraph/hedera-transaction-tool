import { RegisteredNodeDeleteTransaction } from '@hiero-ledger/sdk';

import { TransactionBaseModel } from './transaction-base.model';

export class RegisteredNodeDeleteTransactionModel extends TransactionBaseModel<RegisteredNodeDeleteTransaction> {
  static readonly TRANSACTION_TYPE = 'RegisteredNodeDeleteTransaction';

  getRegisteredNodeId(): number | null {
    if (this.transaction.registeredNodeId) {
      return this.transaction.registeredNodeId.toNumber();
    }
    return null;
  }
}
