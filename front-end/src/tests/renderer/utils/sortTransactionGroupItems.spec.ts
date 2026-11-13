import type { IGroupItem } from '@renderer/services/organization';
import {
  BackEndTransactionType,
  type ITransaction,
  TransactionStatus,
} from '@shared/interfaces/organization/transactions';
import { compareGroupItems } from '@renderer/utils/sortTransactionGroupItems.ts';
import { TransactionNodeSortField } from '@renderer/utils/sortTransactionNodes.ts';

describe('sortTransactionGroupItems', () => {
  const baseTransaction: ITransaction = {
    id: 0,
    name: '',
    transactionId: '',
    type: BackEndTransactionType.ACCOUNT_CREATE,
    description: '',
    transactionBytes: '',
    unsignedTransactionBytes: undefined,
    status: TransactionStatus.NEW,
    statusCode: undefined,
    signature: '',
    validStart: '',
    isManual: false,
    cutoffAt: undefined,
    createdAt: '',
    executedAt: undefined,
    updatedAt: '',
    mirrorNetwork: '',
    creatorKeyId: 0,
    creatorId: 0,
    creatorEmail: '',
    groupItem: undefined,
    hasRejection: undefined,
  };
  const baseGroupItem: IGroupItem = {
    seq: 10,
    transactionId: 0,
    transaction: baseTransaction,
  };

  describe('compareGroupItems', () => {
    test('TRANSACTION_ID', () => {
      const i1: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, transactionId: 'a' },
      };
      const i2: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, transactionId: 'b' },
      };
      expect(compareGroupItems(i1, i1, TransactionNodeSortField.TRANSACTION_ID)).toBe(0);
      expect(compareGroupItems(i1, i2, TransactionNodeSortField.TRANSACTION_ID)).toBe(-1);
      expect(compareGroupItems(i2, i1, TransactionNodeSortField.TRANSACTION_ID)).toBe(+1);
    });

    test('TRANSACTION_TYPE', () => {
      const i1: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, type: BackEndTransactionType.ACCOUNT_CREATE },
      };
      const i2: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, type: BackEndTransactionType.NODE_UPDATE },
      };
      expect(compareGroupItems(i1, i1, TransactionNodeSortField.TRANSACTION_TYPE)).toBe(0);
      expect(compareGroupItems(i1, i2, TransactionNodeSortField.TRANSACTION_TYPE)).toBe(-1);
      expect(compareGroupItems(i2, i1, TransactionNodeSortField.TRANSACTION_TYPE)).toBe(+1);
    });

    test('DESCRIPTION', () => {
      const i1: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, description: 'abc' },
      };
      const i2: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, description: 'def' },
      };
      expect(compareGroupItems(i1, i1, TransactionNodeSortField.DESCRIPTION)).toBe(0);
      expect(compareGroupItems(i1, i2, TransactionNodeSortField.DESCRIPTION)).toBe(-1);
      expect(compareGroupItems(i2, i1, TransactionNodeSortField.DESCRIPTION)).toBe(+1);
    });

    test('STATUS', () => {
      const i1: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, status: TransactionStatus.CANCELED },
      };
      const i2: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, status: TransactionStatus.REJECTED },
      };
      expect(compareGroupItems(i1, i1, TransactionNodeSortField.STATUS)).toBe(0);
      expect(compareGroupItems(i1, i2, TransactionNodeSortField.STATUS)).toBe(-1);
      expect(compareGroupItems(i2, i1, TransactionNodeSortField.STATUS)).toBe(+1);
    });

    test('VALID_START_DATE', () => {
      const i1: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, validStart: 'abc' },
      };
      const i2: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, validStart: 'cde' },
      };
      expect(compareGroupItems(i1, i1, TransactionNodeSortField.VALID_START_DATE)).toBe(0);
      expect(compareGroupItems(i1, i2, TransactionNodeSortField.VALID_START_DATE)).toBe(-1);
      expect(compareGroupItems(i2, i1, TransactionNodeSortField.VALID_START_DATE)).toBe(+1);
    });

    test('CREATED_AT_DATE', () => {
      const i1: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, createdAt: 'abc' },
      };
      const i2: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, createdAt: 'cde' },
      };
      expect(compareGroupItems(i1, i1, TransactionNodeSortField.CREATED_AT_DATE)).toBe(0);
      expect(compareGroupItems(i1, i2, TransactionNodeSortField.CREATED_AT_DATE)).toBe(-1);
      expect(compareGroupItems(i2, i1, TransactionNodeSortField.CREATED_AT_DATE)).toBe(+1);
    });

    test('EXECUTED_AT_DATE', () => {
      const i1: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, executedAt: 'abc' },
      };
      const i2: IGroupItem = {
        ...baseGroupItem,
        transaction: { ...baseTransaction, executedAt: 'cde' },
      };
      expect(compareGroupItems(i1, i1, TransactionNodeSortField.EXECUTED_AT_DATE)).toBe(0);
      expect(compareGroupItems(i1, i2, TransactionNodeSortField.EXECUTED_AT_DATE)).toBe(-1);
      expect(compareGroupItems(i2, i1, TransactionNodeSortField.EXECUTED_AT_DATE)).toBe(+1);
    });
  });
});
