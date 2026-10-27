import type { Transaction } from '@hiero-ledger/sdk';

// Keep each constructor paired with its typed reader when test tables form a union.
export function transactionCase<T extends Transaction, D>(
  name: string,
  TransactionClass: new () => T,
  getData: (transaction: T) => D,
) {
  return [
    name,
    TransactionClass,
    (transaction: Transaction): D => {
      if (!(transaction instanceof TransactionClass)) {
        throw new Error(`Unexpected transaction type for ${name}`);
      }
      return getData(transaction);
    },
  ] as const;
}
