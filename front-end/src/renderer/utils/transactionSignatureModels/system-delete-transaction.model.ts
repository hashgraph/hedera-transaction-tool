import { SystemDeleteTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction.model';

export default class SystemDeleteTransactionModel extends TransactionBaseModel<SystemDeleteTransaction> {
  getSigningAccountsOrKeys(): Set<string> {
    // System deletes can only be done with these two accounts.
    return new Set(['0.0.2', '0.0.50']);
  }
}
