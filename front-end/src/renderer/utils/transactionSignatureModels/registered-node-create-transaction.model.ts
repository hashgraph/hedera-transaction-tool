import { RegisteredNodeCreateTransaction } from '@hiero-ledger/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class RegisteredNodeCreateTransactionModel extends TransactionBaseModel<RegisteredNodeCreateTransaction> {
  override getNewKeys() {
    if (this.transaction.adminKey != null) {
      return [this.transaction.adminKey];
    }

    return [];
  }
}
