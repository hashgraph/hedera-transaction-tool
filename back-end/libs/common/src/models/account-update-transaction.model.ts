import { AccountUpdateTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class AccountUpdateTransactionModel extends TransactionBaseModel<AccountUpdateTransaction> {
  // New key is required:
  // https://docs.hedera.com/hedera/sdks-and-apis/sdks/accounts-and-hbar/update-an-account
  getNewKeys() {
    if (this.transaction.key != null) {
      return [this.transaction.key];
    }
    return [];
  }

  getSigningAccounts(): Set<string> {
    const set = super.getSigningAccounts();
    if (this.transaction.accountId) {
      set.add(this.transaction.accountId.toString());
    }
    return set;
  }
}
