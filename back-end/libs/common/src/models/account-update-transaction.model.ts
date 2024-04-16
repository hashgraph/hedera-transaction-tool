import { AccountUpdateTransaction } from '@hashgraph/sdk';
import { flattenKeyList } from '@app/common';

import { TransactionBaseModel } from './transaction.model';

export default class AccountUpdateTransactionModel extends TransactionBaseModel<AccountUpdateTransaction> {
  getNewKeys(): Set<string> {
    if (this.transaction.key != null) {
      return new Set(flattenKeyList(this.transaction.key).map(key => key.toStringRaw()));
    }
    return new Set();
  }

  getSigningAccounts(): Set<string> {
    const set = super.getSigningAccounts();
    set.add(this.transaction.accountId.toString());
    return set;
  }
}
