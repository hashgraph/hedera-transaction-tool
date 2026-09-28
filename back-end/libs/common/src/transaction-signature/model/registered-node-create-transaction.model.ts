import { RegisteredNodeCreateTransaction } from '@hiero-ledger/sdk';

import { TransactionBaseModel } from './transaction-base.model';

export class RegisteredNodeCreateTransactionModel
  extends TransactionBaseModel<RegisteredNodeCreateTransaction> {

  static readonly TRANSACTION_TYPE = 'RegisteredNodeCreateTransaction';

  override getNewKeys() {
    if (this.transaction.adminKey != null) {
      return [this.transaction.adminKey];
    }

    return [];
  }
}
