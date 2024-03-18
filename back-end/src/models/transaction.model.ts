import { Transaction } from '@hashgraph/sdk';

export abstract class TransactionBaseModel {
  constructor(protected transaction: Transaction) {}

  toBytes(): Promise<Uint8Array> {
    return this.transaction.toBytesAsync();
  }

  getSigningAccountsOrKeys(): Set<string> {
    return new Set<string>([this.transaction.transactionId?.accountId?.toString()]);
  }
}