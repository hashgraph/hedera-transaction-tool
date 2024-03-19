import { TransactionBaseModel } from './transaction.model';
import { FileUpdateTransaction } from '@hashgraph/sdk';
import { flatPublicKeys } from '../utils/encryption-utils';

export default class FileUpdateTransactionModel extends TransactionBaseModel {
  getNewKeys(): Set<string> {
    const accounts = new Set<string>();

    const transaction = this.transaction as FileUpdateTransaction;
    // Get the new key. Flatten the key into an array of key bytes
    const publicKeys = new Set(flatPublicKeys(...transaction.keys).map((key) => key.toString('hex')));
    // Add them to the set
    publicKeys.forEach(accounts.add, accounts);
    return accounts;
  }
}