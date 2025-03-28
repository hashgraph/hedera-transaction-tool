import { Key, ScheduleCreateTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction.model';

export default class ScheduleCreateTransactionModel extends TransactionBaseModel<ScheduleCreateTransaction> {
  getSigningAccounts(): Set<string> {
    const set = super.getSigningAccounts();

    const underlyingPayer = this.transaction.payerAccountId;

    if (underlyingPayer) {
      set.add(underlyingPayer.toString());
    }

    return set;
  }

  getNewKeys(): Key[] {
    const keys = super.getNewKeys();

    if (this.transaction.adminKey) {
      keys.push(this.transaction.adminKey);
    }

    return keys;
  }
}
