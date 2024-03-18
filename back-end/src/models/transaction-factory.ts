import {
  AccountCreateTransaction,
  AccountUpdateTransaction,
  FileAppendTransaction,
  FileUpdateTransaction,
  FreezeTransaction,
  SystemDeleteTransaction,
  Transaction,
  TransferTransaction
} from '@hashgraph/sdk';
import TransferTransactionModel from './transfer-transaction.model';
import AccountCreateTransactionModel from './account-create-transaction.model';
import AccountUpdateTransactionModel from './account-update-transaction.model';
import SystemDeleteTransactionModel from './system-delete-transaction.model';
import FileUpdateTransactionModel from './file-update-transaction.model';
import FreezeTransactionModel from './freeze-transaction.model';
import FileAppendTransactionModel from './file-append-transaction.model';

export default class TransactionFactory {
  static fromBytes(bytes: Buffer) {
    const transaction = Transaction.fromBytes(bytes);
    switch (transaction.constructor) {
      case TransferTransaction:
        return new TransferTransactionModel(transaction);
      case AccountCreateTransaction:
        return new AccountCreateTransactionModel(transaction);
      case AccountUpdateTransaction:
        return new AccountUpdateTransactionModel(transaction);
      case SystemDeleteTransaction:
        return new SystemDeleteTransactionModel(transaction);
      case FreezeTransaction:
        return new FreezeTransactionModel(transaction);
      case FileUpdateTransaction:
        return new FileUpdateTransactionModel(transaction);
      case FileAppendTransaction:
        return new FileAppendTransactionModel(transaction);
      default:
        throw new Error('Transaction type unknown');
    }
  }
}
