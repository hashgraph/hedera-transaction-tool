import { AccountAllowanceApproveTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class AccountAllowanceApproveTransactionModel extends TransactionBaseModel<AccountAllowanceApproveTransaction> {
  override getSigningAccounts(): Set<string> {
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
