import { FileCreateTransaction, Key } from '@hiero-ledger/sdk';

import { TransactionBaseModel } from './transaction-base.model';

export class FileCreateTransactionModel
  extends TransactionBaseModel<FileCreateTransaction> {

  static readonly TRANSACTION_TYPE = 'FileCreateTransaction';

  getNewKeys(): Key[] {
    return this.transaction.keys || [];
  }
}
