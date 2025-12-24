import { FileCreateTransaction, Key } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction-base.model';
import TransactionFactory from './transaction-factory';

export default class FileCreateTransactionModel
  extends TransactionBaseModel<FileCreateTransaction> {

  static readonly TRANSACTION_TYPE = 'FileCreateTransaction';

  getNewKeys(): Key[] {
    return this.transaction.keys || [];
  }
}

TransactionFactory.register(
  FileCreateTransactionModel.TRANSACTION_TYPE,
  FileCreateTransactionModel
);
