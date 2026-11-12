import {
  TransactionNodeSortField,
} from '@renderer/utils/sortTransactionNodes.ts';
import type { IGroupItem } from '@renderer/services/organization';
import { compareString } from '@shared/interfaces';
import { getTransactionTypeFromBackendType } from '@renderer/utils/sdk/transactions.ts';

export function sortTransactionGroupItems(
  items: IGroupItem[],
  sort: TransactionNodeSortField,
): void {
  items.sort((i1, i2) => compareGroupItems(i1, i2, sort));
}

export function compareGroupItems(i1: IGroupItem, i2: IGroupItem, sort: TransactionNodeSortField): number {
  let result: number;
  switch (sort) {
    case TransactionNodeSortField.TRANSACTION_ID:
      result = compareString(i1.transaction.transactionId, i2.transaction.transactionId);
      if (result === 0) {
        // n1 and n2 are groups
        result = compareString(i1.transaction.validStart, i1.transaction.validStart);
      }
      break;
    case TransactionNodeSortField.TRANSACTION_TYPE:
      const bt1 = i1.transaction.type;
      const bt2 = i2.transaction.type;
      const t1 = bt1 ? getTransactionTypeFromBackendType(bt1) : undefined;
      const t2 = bt2 ? getTransactionTypeFromBackendType(bt2) : undefined;
      result = compareString(t1, t2);
      if (result === 0) {
        result = compareString(i1.transaction.validStart, i1.transaction.validStart);
      }
      break;
    case TransactionNodeSortField.DESCRIPTION:
      result = compareString(i1.transaction.description, i2.transaction.description);
      if (result === 0) {
        result = compareString(i1.transaction.validStart, i1.transaction.validStart);
      }
      break;
    case TransactionNodeSortField.STATUS:
      result = compareString(i1.transaction.status, i2.transaction.status);
      if (result === 0) {
        result = compareString(i1.transaction.validStart, i1.transaction.validStart);
      }
      break;
    case TransactionNodeSortField.VALID_START_DATE:
      result = compareString(i1.transaction.validStart, i2.transaction.validStart);
      if (result === 0) {
        result = compareString(i1.transaction.transactionId, i2.transaction.transactionId);
      }
      break;
    case TransactionNodeSortField.CREATED_AT_DATE:
      result = compareString(i1.transaction.createdAt, i2.transaction.createdAt);
      if (result === 0) {
        result = compareString(i1.transaction.transactionId, i2.transaction.transactionId);
      }
      break;
    case TransactionNodeSortField.EXECUTED_AT_DATE:
      result = compareString(i1.transaction.executedAt, i2.transaction.executedAt);
      if (result === 0) {
        result = compareString(i1.transaction.transactionId, i2.transaction.transactionId);
      }
      break;
  }
  return result;
}
