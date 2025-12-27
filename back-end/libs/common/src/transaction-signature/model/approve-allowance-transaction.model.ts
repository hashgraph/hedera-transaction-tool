import { AccountAllowanceApproveTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction-base.model';
import TransactionFactory from './transaction-factory';

export default class AccountAllowanceApproveTransactionModel
  extends TransactionBaseModel<AccountAllowanceApproveTransaction> {

  static readonly TRANSACTION_TYPE = 'AccountAllowanceApproveTransaction';

  getSigningAccounts(): Set<string> {
    const set = super.getSigningAccounts();

    this.transaction.hbarApprovals.forEach(value => {
      set.add(value.ownerAccountId?.toString() || '');
    });

    this.transaction.tokenApprovals.forEach(value => {
      set.add(value.ownerAccountId?.toString() || '');
    });

    this.transaction.tokenNftApprovals.forEach(value => {
      set.add(value.ownerAccountId?.toString() || '');
    });

    return set;
  }
}

TransactionFactory.register(
  AccountAllowanceApproveTransactionModel.TRANSACTION_TYPE,
  AccountAllowanceApproveTransactionModel
);
