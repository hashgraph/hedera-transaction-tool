import { Transaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';
import { getTransactionType } from '@app/common';
import {
  AccountAllowanceApproveTransactionModel,
  AccountCreateTransactionModel,
  AccountDeleteTransactionModel,
  AccountUpdateTransactionModel,
  FileAppendTransactionModel,
  FileCreateTransactionModel,
  FileUpdateTransactionModel,
  FreezeTransactionModel,
  NodeCreateTransactionModel,
  NodeDeleteTransactionModel,
  NodeUpdateTransactionModel,
  SystemDeleteTransactionModel,
  SystemUndeleteTransactionModel,
  TransferTransactionModel,
} from '.';

type TxModelCtor = new (tx: Transaction) => TransactionBaseModel<any>;

const TRANSACTION_MODEL_MAP = new Map<string, TxModelCtor>([
  ['AccountAllowanceApproveTransaction', AccountAllowanceApproveTransactionModel],
  ['AccountCreateTransaction', AccountCreateTransactionModel],
  ['AccountDeleteTransaction', AccountDeleteTransactionModel],
  ['AccountUpdateTransaction', AccountUpdateTransactionModel],
  ['FileAppendTransaction', FileAppendTransactionModel],
  ['FileCreateTransaction', FileCreateTransactionModel],
  ['FileUpdateTransaction', FileUpdateTransactionModel],
  ['FreezeTransaction', FreezeTransactionModel],
  ['NodeCreateTransaction', NodeCreateTransactionModel],
  ['NodeDeleteTransaction', NodeDeleteTransactionModel],
  ['NodeUpdateTransaction', NodeUpdateTransactionModel],
  ['SystemDeleteTransaction', SystemDeleteTransactionModel],
  ['SystemUndeleteTransaction', SystemUndeleteTransactionModel],
  ['TransferTransaction', TransferTransactionModel],
]);

export default class TransactionFactory {
  static fromTransaction(tx: Transaction): TransactionBaseModel<any> {
    const type = getTransactionType(tx, true);
    const Model = TRANSACTION_MODEL_MAP.get(type);

    if (!Model) {
      throw new Error(`No transaction model registered for type: ${type}`);
    }

    return new Model(tx);
  }

  static fromBytes(bytes: Buffer): TransactionBaseModel<any> {
    return this.fromTransaction(Transaction.fromBytes(bytes));
  }
}