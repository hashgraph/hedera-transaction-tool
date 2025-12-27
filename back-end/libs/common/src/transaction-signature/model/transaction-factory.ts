import { Transaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';
import { getTransactionType } from '@app/common';

type TxModelCtor = new (tx: Transaction) => TransactionBaseModel<any>;

export default class TransactionFactory {
  private static readonly registry = new Map<string, TxModelCtor>();

  static register(type: string, ctor: TxModelCtor): void {
    if (this.registry.has(type)) {
      throw new Error(`Transaction model already registered for ${type}`);
    }
    this.registry.set(type, ctor);
  }

  static fromTransaction(tx: Transaction): TransactionBaseModel<any> {
    const type = getTransactionType(tx, true);
    const Model = this.registry.get(type);

    if (!Model) {
      throw new Error(`No transaction model registered for type: ${type}`);
    }

    return new Model(tx);
  }

  static fromBytes(bytes: Buffer): TransactionBaseModel<any> {
    return this.fromTransaction(Transaction.fromBytes(bytes));
  }
}