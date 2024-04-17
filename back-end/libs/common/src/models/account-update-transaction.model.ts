import { AccountUpdateTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class AccountUpdateTransactionModel extends TransactionBaseModel<AccountUpdateTransaction> {
  getNewKeys() {
    if (this.transaction.key != null) {
      return [this.transaction.key];
    }
    return [];
  }

  getSigningAccounts(): Set<string> {
    const set = super.getSigningAccounts();
    set.add(this.transaction.accountId.toString());
    return set;
  }
}
