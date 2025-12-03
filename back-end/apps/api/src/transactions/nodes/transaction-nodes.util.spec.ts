import { ITransactionNode } from '../dto/ITransactionNode';
import { compareTransactionNodes } from './transaction-nodes.util';
import { TransactionStatus } from '@entities';

const singleNode1: ITransactionNode = {
  transactionId: 1,
  groupId: undefined,
  description: 'Single node 1',
  createdAt: new Date().toISOString(),
  validStart: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  executedAt: undefined,
  status: TransactionStatus.NEW,
  statusCode: undefined,
  sdkTransactionId: '0.0.123@15648433.112315',
  transactionType: 'CREATE ACCOUNT',
  groupItemCount: undefined,
  groupCollectedCount: undefined,
};

const singleNode2: ITransactionNode = {
  transactionId: 2,
  groupId: undefined,
  description: 'Single node 2',
  createdAt: new Date().toISOString(),
  validStart: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  executedAt: undefined,
  status: TransactionStatus.NEW,
  statusCode: undefined,
  sdkTransactionId: '0.0.123@15648433.231511',
  transactionType: 'CREATE ACCOUNT',
  groupItemCount: undefined,
  groupCollectedCount: undefined,
};

const groupNode1: ITransactionNode = {
  transactionId: undefined,
  groupId: 1,
  description: 'Group node 1',
  createdAt: new Date().toISOString(),
  validStart: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  executedAt: undefined,
  status: TransactionStatus.NEW,
  statusCode: undefined,
  sdkTransactionId: undefined,
  transactionType: undefined,
  groupItemCount: 42,
  groupCollectedCount: 21,
};

const groupNode2: ITransactionNode = {
  transactionId: undefined,
  groupId: 2,
  description: 'Group node 2',
  createdAt: new Date().toISOString(),
  validStart: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  executedAt: undefined,
  status: TransactionStatus.NEW,
  statusCode: undefined,
  sdkTransactionId: undefined,
  transactionType: undefined,
  groupItemCount: 21,
  groupCollectedCount: 10,
};

describe('Transaction Node Utils', () => {
  it('compareTransactionNodes()', () => {
    expect(compareTransactionNodes(singleNode1, singleNode2)).toBe(+1);
    expect(compareTransactionNodes(singleNode2, singleNode1)).toBe(-1);
    expect(compareTransactionNodes(singleNode1, singleNode1)).toBe(0);

    expect(compareTransactionNodes(groupNode1, groupNode2)).toBe(+1);
    expect(compareTransactionNodes(groupNode2, groupNode1)).toBe(-1);
    expect(compareTransactionNodes(groupNode1, groupNode1)).toBe(0);

    expect(compareTransactionNodes(groupNode1, singleNode1)).toBe(+1);
    expect(compareTransactionNodes(singleNode1, groupNode1)).toBe(-1);
  });
});
