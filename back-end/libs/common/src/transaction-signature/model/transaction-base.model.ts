import { AccountId, Key, Transaction as SDKTransaction } from '@hashgraph/sdk';

export abstract class TransactionBaseModel<T extends SDKTransaction> {
  constructor(protected readonly transaction: T) {}

  getFeePayerAccountId(): AccountId | null {
    const payerId = this.transaction.transactionId?.accountId;
    if (payerId) {
      return payerId;
    }
    return null;
  }

  getSigningAccounts(): Set<string> {
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
