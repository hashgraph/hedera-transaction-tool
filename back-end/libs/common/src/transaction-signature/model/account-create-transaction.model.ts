import { AccountCreateTransaction, Key } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';

export class AccountCreateTransactionModel
  extends TransactionBaseModel<AccountCreateTransaction> {
  static readonly TRANSACTION_TYPE = 'AccountCreateTransaction';

  getNewKeys(): Key[] {
    if (this.transaction.key != null) {
      return [this.transaction.key];
    }
    return [];
  }
}
