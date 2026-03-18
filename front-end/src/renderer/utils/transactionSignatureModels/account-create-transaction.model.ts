import { AccountCreateTransaction, Key } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction.model';

export default class AccountCreateTransactionModel extends TransactionBaseModel<AccountCreateTransaction> {
  override getNewKeys(): Key[] {
    if (this.transaction.key != null) {
      return [this.transaction.key];
    }
    return [];
  }
}
