import { Transaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction.model';
import TransferTransactionModel from './transfer-transaction.model';
import AccountCreateTransactionModel from './account-create-transaction.model';
import AccountUpdateTransactionModel from './account-update-transaction.model';
import SystemDeleteTransactionModel from './system-delete-transaction.model';
import SystemUndeleteTransactionModel from './system-undelete-transaction.model';
import FileUpdateTransactionModel from './file-update-transaction.model';
import FreezeTransactionModel from './freeze-transaction.model';
import FileAppendTransactionModel from './file-append-transaction.model';
import AccountDeleteTransactionModel from './account-delete-transaction.model';
import AccountAllowanceApproveTransactionModel from './approve-allowance-transaction.model';
import FileCreateTransactionModel from './file-create-transaction.model';
import NodeCreateTransactionModel from './node-create-transaction.model';
import NodeUpdateTransactionModel from './node-update-transaction.model';
import NodeDeleteTransactionModel from './node-delete-transaction.model';
import { getTransactionType } from '../sdk/transactions';

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
      SystemUndeleteTransaction: SystemUndeleteTransactionModel,
      FreezeTransaction: FreezeTransactionModel,
      FileUpdateTransaction: FileUpdateTransactionModel,
      FileAppendTransaction: FileAppendTransactionModel,
      AccountDeleteTransaction: AccountDeleteTransactionModel,
      AccountAllowanceApproveTransaction: AccountAllowanceApproveTransactionModel,
      FileCreateTransaction: FileCreateTransactionModel,
      NodeCreateTransaction: NodeCreateTransactionModel,
      NodeUpdateTransaction: NodeUpdateTransactionModel,
      NodeDeleteTransaction: NodeDeleteTransactionModel,
    };

    const transactionType = getTransactionType(transaction, true) as keyof typeof transactionModelMap;

    if (transactionModelMap[transactionType]) {
      const Model = transactionModelMap[transactionType];
      //@ts-expect-error typescript
      return new Model(transaction);
    } else {
      throw new Error('Transaction type unknown');
    }
  }
}
