import { AccountDeleteTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';
import TransactionFactory from './transaction-factory';

export default class AccountDeleteTransactionModel
  extends TransactionBaseModel<AccountDeleteTransaction> {

  static readonly TRANSACTION_TYPE = 'AccountDeleteTransaction';

  getSigningAccounts(): Set<string> {
    const set = super.getSigningAccounts();
    if (this.transaction.accountId) {
      set.add(this.transaction.accountId.toString());
    }
    return set;
  }

  getReceiverAccounts(): Set<string> {
    return new Set<string>(
      this.transaction.transferAccountId ? [this.transaction.transferAccountId.toString()] : [],
    );
  }
}

TransactionFactory.register(
  AccountDeleteTransactionModel.TRANSACTION_TYPE,
  AccountDeleteTransactionModel
);
