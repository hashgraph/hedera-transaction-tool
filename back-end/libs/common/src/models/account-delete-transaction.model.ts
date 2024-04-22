import { AccountDeleteTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction.model';

export default class AccountDeleteTransactionModel extends TransactionBaseModel<AccountDeleteTransaction> {
  getReceiverAccounts(): Set<string> {
    return new Set<string>([this.transaction.accountId.toString()]);
  }
}
