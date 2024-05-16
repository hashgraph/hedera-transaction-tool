import { AccountDeleteTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction.model';

export default class AccountDeleteTransactionModel extends TransactionBaseModel<AccountDeleteTransaction> {
  getSigningAccounts(): Set<string> {
    const set = super.getSigningAccounts();
    set.add(this.transaction.accountId.toString());
    return set;
  }

  getReceiverAccounts(): Set<string> {
    return new Set<string>([this.transaction.accountId.toString()]);
  }
}
