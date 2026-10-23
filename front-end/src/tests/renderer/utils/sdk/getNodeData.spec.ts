// @vitest-environment node
import { describe, test, expect } from 'vitest';
import { Hbar, NodeCreateTransaction, NodeUpdateTransaction } from '@hiero-ledger/sdk';
import Long from 'long';

import {
  createNodeCreateTransaction,
  createNodeUpdateTransaction,
  type NodeData,
  type NodeUpdateData,
} from '@renderer/utils/sdk/createTransactions';
import { getNodeData, getNodeUpdateData } from '@renderer/utils/sdk/getData';

const common = {
  payerId: '0.0.2',
  validStart: new Date('2026-01-01T00:00:00Z'),
  maxTransactionFee: new Hbar(2),
  transactionMemo: '',
};

const baseData: NodeData = {
  nodeAccountId: '0.0.3',
  description: '',
  gossipEndpoints: [],
  serviceEndpoints: [],
  grpcWebProxyEndpoint: null,
  gossipCaCertificate: Uint8Array.from([]),
  certificateHash: Uint8Array.from([]),
  adminKey: null,
  declineReward: false,
  associatedRegisteredNodes: [],
};

describe('getNodeData — associatedRegisteredNodes', () => {
  test('NodeCreate with no registered nodes returns an empty array', () => {
    const tx = createNodeCreateTransaction({ ...common, ...baseData });
    const parsed = getNodeData(tx);
    expect(parsed.associatedRegisteredNodes).toEqual([]);
  });

  test('NodeCreate with values returns them as decimal strings', () => {
    const tx = createNodeCreateTransaction({
      ...common,
      ...baseData,
      associatedRegisteredNodes: ['1', '7', '12'],
    });
    const parsed = getNodeData(tx);
    expect(parsed.associatedRegisteredNodes).toEqual(['1', '7', '12']);
  });
});

describe('getNodeUpdateData — associatedRegisteredNodes', () => {

  test('NodeUpdate where the field was never set returns [] - without baseline', () => {
    const updateData: NodeUpdateData = { ...baseData, nodeId: '3' };
    const tx = createNodeUpdateTransaction({ ...common, ...updateData }, null);
    expect(tx.associatedRegisteredNodes).toEqual([]);
    const parsed = getNodeUpdateData(tx, null);
    expect(parsed.associatedRegisteredNodes).toEqual([]);
  });

  test('NodeUpdate where the field was never set returns [] - with baseline', () => {
    const updateData: NodeUpdateData = { ...baseData, nodeId: '3' };
    const blankBaseline = new NodeUpdateTransaction();
    const tx = createNodeUpdateTransaction({ ...common, ...updateData }, blankBaseline);
    expect(tx.associatedRegisteredNodes).toBeNull();
    const parsed = getNodeUpdateData(tx, blankBaseline);
    expect(parsed.associatedRegisteredNodes).toEqual([]);
  });

  test('NodeUpdate where the field was explicitly cleared returns []', () => {
    const tx = new NodeUpdateTransaction();
    tx.setNodeId(Long.fromNumber(3));
    tx.setAssociatedRegisteredNodes([]);
    expect(getNodeUpdateData(tx, null).associatedRegisteredNodes).toEqual([]);
  });

  test('NodeUpdate with values returns them as decimal strings', () => {
    const tx = new NodeUpdateTransaction();
    tx.setNodeId(Long.fromNumber(3));
    tx.setAssociatedRegisteredNodes([Long.fromNumber(5), Long.fromNumber(8)]);
    expect(getNodeUpdateData(tx, null).associatedRegisteredNodes).toEqual(['5', '8']);
  });

  test('throws on non-Node transactions (sanity check on the assertion path)', () => {
    const tx = new NodeCreateTransaction();
    // Replace prototype so instanceof check fails — a quick way to stress the guard.
    Object.setPrototypeOf(tx, Object.prototype);
    expect(() => getNodeData(tx)).toThrow();
  });
});
