import { Transaction } from '@hashgraph/sdk';
import TransferTransactionModel from './transfer-transaction.model';
import AccountCreateTransactionModel from './account-create-transaction.model';
import AccountUpdateTransactionModel from './account-update-transaction.model';
import SystemDeleteTransactionModel from './system-delete-transaction.model';
import FileUpdateTransactionModel from './file-update-transaction.model';
import FreezeTransactionModel from './freeze-transaction.model';
import FileAppendTransactionModel from './file-append-transaction.model';
import AccountDeleteTransactionModel from './account-delete-transaction.model';
import FileCreateTransactionModel from './file-create-transaction.model';
import AccountAllowanceApproveTransactionModel from './approve-allowance-transaction.model';
import { TransactionBaseModel } from './transaction.model';

export default class TransactionFactory {
  static fromBytes(bytes: Buffer) {
    const transaction = Transaction.fromBytes(bytes);
    return this.fromTransaction(transaction);
  }

  static fromTransaction(transaction: Transaction): TransactionBaseModel<Transaction> {
    const transactionModelMap = {
      TransferTransaction: TransferTransactionModel,
      AccountCreateTransaction: AccountCreateTransactionModel,
      AccountUpdateTransaction: AccountUpdateTransactionModel,
      SystemDeleteTransaction: SystemDeleteTransactionModel,
      FreezeTransaction: FreezeTransactionModel,
      FileUpdateTransaction: FileUpdateTransactionModel,
      FileAppendTransaction: FileAppendTransactionModel,
      AccountDeleteTransaction: AccountDeleteTransactionModel,
      AccountAllowanceApproveTransaction: AccountAllowanceApproveTransactionModel,
      FileCreateTransaction: FileCreateTransactionModel,
    };

    const transactionType = transaction.constructor.name.slice(
      transaction.constructor.name.startsWith('_') ? 1 : 0,
    );

    if (transactionModelMap[transactionType]) {
      return new transactionModelMap[transactionType](transaction);
    } else {
      throw new Error('Transaction type unknown');
    }
  }
}
