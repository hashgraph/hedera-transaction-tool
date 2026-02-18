import { type ITransactionNode } from '../../../../shared/src/ITransactionNode.ts';
import { getTransactionTypeFromBackendType } from '@renderer/utils/sdk/transactions.ts';
import { compareString } from '@shared/interfaces';

export enum TransactionNodeSortField {
  TRANSACTION_ID,
  TRANSACTION_TYPE,
  DESCRIPTION,
  STATUS,
  VALID_START_DATE,
  EXECUTED_AT_DATE,
  CREATED_AT_DATE,
}

const SORT_FIELD_URL_MAP: Record<TransactionNodeSortField, string> = {
  [TransactionNodeSortField.TRANSACTION_ID]: 'TRANSACTION_ID',
  [TransactionNodeSortField.TRANSACTION_TYPE]: 'TRANSACTION_TYPE',
  [TransactionNodeSortField.DESCRIPTION]: 'DESCRIPTION',
  [TransactionNodeSortField.STATUS]: 'STATUS',
  [TransactionNodeSortField.VALID_START_DATE]: 'VALID_START_DATE',
  [TransactionNodeSortField.EXECUTED_AT_DATE]: 'EXECUTED_AT_DATE',
  [TransactionNodeSortField.CREATED_AT_DATE]: 'CREATED_AT_DATE',
};

const URL_TO_SORT_FIELD_MAP: Record<string, TransactionNodeSortField> = Object.fromEntries(
  Object.entries(SORT_FIELD_URL_MAP).map(([k, v]) => [v, Number(k) as TransactionNodeSortField]),
);

export const TRANSACTION_NODE_SORT_URL_VALUES: string[] = Object.values(SORT_FIELD_URL_MAP);

export function sortFieldToUrl(field: TransactionNodeSortField): string {
  return SORT_FIELD_URL_MAP[field];
}

export function sortFieldFromUrl(value: string): TransactionNodeSortField | undefined {
  return URL_TO_SORT_FIELD_MAP[value];
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
    case TransactionNodeSortField.STATUS:
      result = compareString(n1.status, n2.status);
      if (result === 0) {
        result = compareString(n1.validStart, n2.validStart);
      }
      break;
    case TransactionNodeSortField.VALID_START_DATE:
      result = compareString(n1.validStart, n2.validStart);
      if (result === 0) {
        result = compareString(n1.sdkTransactionId, n2.sdkTransactionId);
      }
      break;
    case TransactionNodeSortField.CREATED_AT_DATE:
      result = compareString(n1.createdAt, n2.createdAt);
      if (result === 0) {
        result = compareString(n1.sdkTransactionId, n2.sdkTransactionId);
      }
      break;
    case TransactionNodeSortField.EXECUTED_AT_DATE:
      result = compareString(n1.executedAt, n2.executedAt);
      if (result === 0) {
        result = compareString(n1.sdkTransactionId, n2.sdkTransactionId);
      }
      break;

  }
  return result;
}
