import { FileUpdateTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class FileUpdateTransactionModel extends TransactionBaseModel<FileUpdateTransaction> {
  getNewKeys() {
    return this.transaction.keys;
  }
}
