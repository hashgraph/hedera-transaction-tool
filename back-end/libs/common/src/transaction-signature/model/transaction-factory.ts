import {
  AccountAllowanceApproveTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountUpdateTransaction,
  FileAppendTransaction,
  FileCreateTransaction,
  FileUpdateTransaction,
  FreezeTransaction,
  NodeCreateTransaction,
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  RegisteredNodeCreateTransaction,
  RegisteredNodeDeleteTransaction,
  RegisteredNodeUpdateTransaction,
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
  Transaction,
  TransferTransaction,
} from '@hiero-ledger/sdk';
import { TransactionBaseModel } from './transaction-base.model';
import { AccountAllowanceApproveTransactionModel } from './account-allowance-approve-transaction.model';
import { AccountCreateTransactionModel } from './account-create-transaction.model';
import { AccountDeleteTransactionModel } from './account-delete-transaction.model';
import { AccountUpdateTransactionModel } from './account-update-transaction.model';
import { FileAppendTransactionModel } from './file-append-transaction.model';
import { FileCreateTransactionModel } from './file-create-transaction.model';
import { FileUpdateTransactionModel } from './file-update-transaction.model';
import { FreezeTransactionModel } from './freeze-transaction.model';
import { NodeCreateTransactionModel } from './node-create-transaction.model';
import { NodeDeleteTransactionModel } from './node-delete-transaction.model';
import { NodeUpdateTransactionModel } from './node-update-transaction.model';
import { RegisteredNodeCreateTransactionModel } from './registered-node-create-transaction.model';
import { RegisteredNodeUpdateTransactionModel } from './registered-node-update-transaction.model';
import { RegisteredNodeDeleteTransactionModel } from './registered-node-delete-transaction.model';
import { SystemDeleteTransactionModel } from './system-delete-transaction.model';
import { SystemUndeleteTransactionModel } from './system-undelete-transaction.model';
import { TransferTransactionModel } from './transfer-transaction.model';

export default class TransactionFactory {
  static fromTransaction(tx: Transaction): TransactionBaseModel<Transaction> {
    if (tx instanceof AccountCreateTransaction) {
      return new AccountCreateTransactionModel(tx);
    } else if (tx instanceof AccountUpdateTransaction) {
      return new AccountUpdateTransactionModel(tx);
    } else if (tx instanceof AccountDeleteTransaction) {
      return new AccountDeleteTransactionModel(tx);
    } else if (tx instanceof TransferTransaction) {
      return new TransferTransactionModel(tx);
    } else if (tx instanceof AccountAllowanceApproveTransaction) {
      return new AccountAllowanceApproveTransactionModel(tx);
    } else if (tx instanceof FileCreateTransaction) {
      return new FileCreateTransactionModel(tx);
    } else if (tx instanceof FileUpdateTransaction) {
      return new FileUpdateTransactionModel(tx);
    } else if (tx instanceof FileAppendTransaction) {
      return new FileAppendTransactionModel(tx);
    } else if (tx instanceof FreezeTransaction) {
      return new FreezeTransactionModel(tx);
    } else if (tx instanceof NodeCreateTransaction) {
      return new NodeCreateTransactionModel(tx);
    } else if (tx instanceof NodeUpdateTransaction) {
      return new NodeUpdateTransactionModel(tx);
    } else if (tx instanceof NodeDeleteTransaction) {
      return new NodeDeleteTransactionModel(tx);
    } else if (tx instanceof RegisteredNodeCreateTransaction) {
      return new RegisteredNodeCreateTransactionModel(tx);
    } else if (tx instanceof RegisteredNodeUpdateTransaction) {
      return new RegisteredNodeUpdateTransactionModel(tx);
    } else if (tx instanceof RegisteredNodeDeleteTransaction) {
      return new RegisteredNodeDeleteTransactionModel(tx);
    } else if (tx instanceof SystemDeleteTransaction) {
      return new SystemDeleteTransactionModel(tx);
    } else if (tx instanceof SystemUndeleteTransaction) {
      return new SystemUndeleteTransactionModel(tx);
    } else {
      throw new Error(`No transaction model registered for type: ${tx.constructor.name}`);
    }
  }

  static fromBytes(bytes: Buffer): TransactionBaseModel<Transaction> {
    return this.fromTransaction(Transaction.fromBytes(bytes));
  }
}
