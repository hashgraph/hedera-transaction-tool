import { AccountDeleteTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction.model';

export default class AccountDeleteTransactionModel extends TransactionBaseModel<AccountDeleteTransaction> {
  override getSigningAccounts(): Set<string> {
    const set = super.getSigningAccounts();
    this.transaction.accountId && set.add(this.transaction.accountId.toString());
    return set;
  }

  override getReceiverAccounts(): Set<string> {
    return new Set<string>(
      this.transaction.transferAccountId ? [this.transaction.transferAccountId.toString()] : [],
    );
  }
}
