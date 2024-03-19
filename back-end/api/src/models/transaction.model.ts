import { Transaction } from '@hashgraph/sdk';

export abstract class TransactionBaseModel {
  constructor(protected transaction: Transaction) {}

  toBytes(): Promise<Uint8Array> {
    return this.transaction.toBytesAsync();
  }

  getSigningAccounts(): Set<string> {
    return new Set<string>([this.transaction.transactionId?.accountId?.toString()]);
  }

  getReceiverAccounts(): Set<string> {
    return new Set<string>();
  }

  getNewKeys(): Set<string> {
    return new Set<string>();
  }
}