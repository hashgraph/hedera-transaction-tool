import { ScheduleCreateTransaction, Transaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction.model';

export default class ScheduleCreateTransactionModel extends TransactionBaseModel<ScheduleCreateTransaction> {
  getSigningAccounts(): Set<string> {
    const set = super.getSigningAccounts();

    //@ts-expect-error private
    const underlyingTransaction = this.transaction._scheduledTransaction as Transaction;

    if (underlyingTransaction.transactionId?.accountId) {
      set.add(underlyingTransaction.transactionId.accountId.toString());
    }

    return set;
  }
}
