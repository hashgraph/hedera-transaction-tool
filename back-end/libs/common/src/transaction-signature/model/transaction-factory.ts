import { Transaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';
import { getTransactionType } from '@app/common';
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
import { SystemDeleteTransactionModel } from './system-delete-transaction.model';
import { SystemUndeleteTransactionModel } from './system-undelete-transaction.model';
import { TransferTransactionModel } from './transfer-transaction.model';

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