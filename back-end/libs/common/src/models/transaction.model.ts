import { Key, Transaction } from '@hashgraph/sdk';

export abstract class TransactionBaseModel<T extends Transaction> {
  constructor(protected transaction: T) {}

  toBytes(): Uint8Array {
    return this.transaction.toBytes();
  }

  toBytesAsync(): Promise<Uint8Array> {
    return this.transaction.toBytesAsync();
  }

  getSigningAccounts(): Set<string> {
    const payerId = this.transaction.transactionId?.accountId;
    if (payerId) {
      return new Set<string>([payerId.toString()]);
    }
    return new Set<string>();
  }

  getReceiverAccounts(): Set<string> {
    return new Set<string>();
  }

  getNewKeys(): Key[] {
    return [];
  }

  getNodeId(): number | null {
    return null;
  }
}
