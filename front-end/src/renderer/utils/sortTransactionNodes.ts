import { type ITransactionNode } from '../../../../middle-end/src/ITransactionNode.ts';
import { getTransactionTypeFromBackendType } from '@renderer/utils/sdk/transactions.ts';
import { compareString } from '@shared/interfaces';

export enum TransactionNodeSortField {
  TRANSACTION_ID,
  TRANSACTION_TYPE,
  DESCRIPTION,
  VALID_START_DATE,
  EXECUTION_DATE,
}
export function sortTransactionNodes(
  nodes: ITransactionNode[],
  sort: TransactionNodeSortField,
): void {
  nodes.sort((n1, n2) => compareTransactionNodes(n1, n2, sort));
}

export function compareTransactionNodes(
  n1: ITransactionNode,
  n2: ITransactionNode,
  sort: TransactionNodeSortField,
): number {
  let result: number;
  switch (sort) {
    case TransactionNodeSortField.TRANSACTION_ID:
      result = compareString(n1.sdkTransactionId, n2.sdkTransactionId);
      if (result === 0) {
        // n1 and n2 are groups
        result = compareString(n1.validStart, n2.validStart);
      }
      break;
    case TransactionNodeSortField.TRANSACTION_TYPE:
      const bt1 = n1.transactionType;
      const bt2 = n2.transactionType;
      const t1 = bt1 ? getTransactionTypeFromBackendType(bt1) : undefined;
      const t2 = bt2 ? getTransactionTypeFromBackendType(bt2) : undefined;
      result = compareString(t1, t2);
      if (result === 0) {
        result = compareString(n1.validStart, n2.validStart);
      }
      break;
    case TransactionNodeSortField.DESCRIPTION:
      result = compareString(n1.description, n2.description);
      if (result === 0) {
        result = compareString(n1.validStart, n2.validStart);
      }
      break;
    case TransactionNodeSortField.VALID_START_DATE:
    case TransactionNodeSortField.EXECUTION_DATE: // To be implemented
      result = compareString(n1.validStart, n2.validStart);
      if (result === 0) {
        result = compareString(n1.sdkTransactionId, n2.sdkTransactionId);
      }
      break;
  }
  return result;
}
