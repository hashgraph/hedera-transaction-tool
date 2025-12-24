import { FileAppendTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';
import TransactionFactory from './transaction-factory';

export default class FileAppendTransactionModel
  extends TransactionBaseModel<FileAppendTransaction> {
  static readonly TRANSACTION_TYPE = 'FileAppendTransaction';
}

TransactionFactory.register(
  FileAppendTransactionModel.TRANSACTION_TYPE,
  FileAppendTransactionModel
);
