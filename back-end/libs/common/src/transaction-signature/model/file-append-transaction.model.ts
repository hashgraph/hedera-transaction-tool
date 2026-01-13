import { FileAppendTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';

export class FileAppendTransactionModel
  extends TransactionBaseModel<FileAppendTransaction> {
  static readonly TRANSACTION_TYPE = 'FileAppendTransaction';
}
