import { FileCreateTransaction, Key } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class FileCreateTransactionModel extends TransactionBaseModel<FileCreateTransaction> {
  override getNewKeys(): Key[] {
    return this.transaction.keys || [];
  }
}
