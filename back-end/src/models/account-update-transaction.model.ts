import { TransactionBaseModel } from './transaction.model';
import { AccountUpdateTransaction } from '@hashgraph/sdk';
import { flatPublicKeys } from '../utils/encryption-utils';

export default class AccountUpdateTransactionModel extends TransactionBaseModel {
  getSigningAccountsOrKeys(): Set<string> {
    const accounts = super.getSigningAccountsOrKeys();

    const transaction = this.transaction as AccountUpdateTransaction;
    // Push the accountId to the array, if available
    accounts.add(transaction.accountId?.toString());
    // Get the new key. Flatten the key into an array of key bytes
    const publicKeys = new Set(flatPublicKeys(transaction.key).map((key) => key.toString('hex')));
    // Add them to the set
    publicKeys.forEach(accounts.add, accounts);
    return accounts;
  }
}