import { ITransactionNode } from '../dto/ITransactionNode';
import { compareTransactionNodes } from './transaction-nodes.util';
import { TransactionStatus } from '@entities';

const singleNodeDate1 = 0;

const singleNode1: ITransactionNode = {
  transactionId: 1,
  groupId: undefined,
  description: 'Single node 1',
  createdAt: new Date(singleNodeDate1).toISOString(),
  validStart: new Date(singleNodeDate1 + 2000).toISOString(),
  updatedAt: new Date(singleNodeDate1 + 1000).toISOString(),
  executedAt: undefined,
  status: TransactionStatus.NEW,
  statusCode: undefined,
  sdkTransactionId: '0.0.123@15648433.112315',
  transactionType: 'CREATE ACCOUNT',
  groupItemCount: undefined,
  groupCollectedCount: undefined,
};

const singleNodeDate2 = 1000;

const singleNode2: ITransactionNode = {
  transactionId: 2,
  groupId: undefined,
  description: 'Single node 2',
  createdAt: new Date(singleNodeDate2).toISOString(),
  validStart: new Date(singleNodeDate2 + 2000).toISOString(),
  updatedAt: new Date(singleNodeDate2 + 1000).toISOString(),
  executedAt: undefined,
  status: TransactionStatus.NEW,
  statusCode: undefined,
  sdkTransactionId: '0.0.123@15648433.231511',
  transactionType: 'CREATE ACCOUNT',
  groupItemCount: undefined,
  groupCollectedCount: undefined,
};

const groupNodeDate1 = 2000;

const groupNode1: ITransactionNode = {
  transactionId: undefined,
  groupId: 1,
  description: 'Group node 1',
  createdAt: new Date(groupNodeDate1).toISOString(),
  validStart: new Date(groupNodeDate1 + 2000).toISOString(),
  updatedAt: new Date(groupNodeDate1 + 1000).toISOString(),
  executedAt: undefined,
  status: TransactionStatus.NEW,
  statusCode: undefined,
  sdkTransactionId: undefined,
  transactionType: undefined,
  groupItemCount: 42,
  groupCollectedCount: 21,
};

const groupNodeDate2 = 3000;

const groupNode2: ITransactionNode = {
  transactionId: undefined,
  groupId: 2,
  description: 'Group node 2',
  createdAt: new Date(groupNodeDate2).toISOString(),
  validStart: new Date(groupNodeDate2 + 2000).toISOString(),
  updatedAt: new Date(groupNodeDate2 + 1000).toISOString(),
  executedAt: undefined,
  status: TransactionStatus.NEW,
  statusCode: undefined,
  sdkTransactionId: undefined,
  transactionType: undefined,
  groupItemCount: 21,
  groupCollectedCount: 10,
};

const malformedNodeDate2 = 3000;

const malformedNode: ITransactionNode = {
  // This node is malformed because both transactionId and groupId are undefined
  // => it's useful only to reach 100% coverage of compareTransactionNodes()
  transactionId: undefined,
  groupId: undefined,
  description: 'Malformed node',
  createdAt: new Date(malformedNodeDate2).toISOString(),
  validStart: new Date(malformedNodeDate2 + 2000).toISOString(),
  updatedAt: new Date(malformedNodeDate2 + 1000).toISOString(),
  executedAt: undefined,
  status: TransactionStatus.NEW,
  statusCode: undefined,
  sdkTransactionId: undefined,
  transactionType: undefined,
  groupItemCount: 21,
  groupCollectedCount: 10,
}

describe('Transaction Node Utils', () => {
  it('compareTransactionNodes()', () => {
    expect(compareTransactionNodes(singleNode1, singleNode2)).toBe(-1);
    expect(compareTransactionNodes(singleNode2, singleNode1)).toBe(+1);
    expect(compareTransactionNodes(singleNode1, singleNode1)).toBe(0);

    expect(compareTransactionNodes(groupNode1, groupNode2)).toBe(-1);
    expect(compareTransactionNodes(groupNode2, groupNode1)).toBe(+1);
    expect(compareTransactionNodes(groupNode1, groupNode1)).toBe(0);

    expect(compareTransactionNodes(groupNode1, singleNode1)).toBe(+1);
    expect(compareTransactionNodes(singleNode1, groupNode1)).toBe(-1);

    expect(compareTransactionNodes(singleNode1, malformedNode)).toBe(+1);
    expect(compareTransactionNodes(malformedNode, singleNode1)).toBe(-1);
  });
});
