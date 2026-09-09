import { AccountDeleteTransaction } from '@hiero-ledger/sdk';
import { TransactionBaseModel } from './transaction-base.model';

export class AccountDeleteTransactionModel
  extends TransactionBaseModel<AccountDeleteTransaction> {

  static readonly TRANSACTION_TYPE = 'AccountDeleteTransaction';

  override getSigningAccounts(): Set<string> {
    const set = super.getSigningAccounts();
    if (this.transaction.accountId) {
      set.add(this.transaction.accountId.toString());
    }
    return set;
  }

  override getReceiverAccounts(): Set<string> {
    return new Set<string>(
      this.transaction.transferAccountId ? [this.transaction.transferAccountId.toString()] : [],
    );
  }
}
