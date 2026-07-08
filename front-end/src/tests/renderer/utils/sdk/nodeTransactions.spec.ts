// @vitest-environment node
import { describe, test, expect } from 'vitest';
import {
  AccountId,
  Hbar,
  NodeCreateTransaction,
  NodeUpdateTransaction,
  Transaction,
} from '@hiero-ledger/sdk';
import Long from 'long';

import {
  createNodeCreateTransaction,
  createNodeUpdateTransaction,
  type NodeData,
  type NodeUpdateData,
} from '@renderer/utils/sdk/createTransactions';
import type { INodeInfoParsed } from '@shared/interfaces';

const common = {
  payerId: '0.0.2',
  validStart: new Date('2026-01-01T00:00:00Z'),
  maxTransactionFee: new Hbar(2),
  transactionMemo: '',
};

function makeNodeData(overrides: Partial<NodeData> = {}): NodeData {
  return {
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
    ...overrides,
  };
}

function makeOldNodeInfo(
  overrides: Partial<INodeInfoParsed> = {},
): INodeInfoParsed {
  return {
    admin_key: null,
    description: '',
    file_id: null,
    memo: null,
    node_id: 3,
    node_account_id: AccountId.fromString('0.0.3'),
    node_cert_hash: null,
    public_key: null,
    service_endpoints: [],
    timestamp: null,
    max_stake: null,
    min_stake: null,
    stake: null,
    stake_not_rewarded: null,
    stake_rewarded: null,
    staking_period: null,
    reward_rate_start: null,
    decline_reward: false,
    grpc_web_proxy_endpoint: null,
    associated_registered_nodes: [],
    ...overrides,
  };
}

function longs(values: number[]) {
  return values.map(v => Long.fromNumber(v));
}

// Compare a Long[] field by decimal string. Proto-decoded Longs come back as
// `unsigned: true` (since the proto field is uint64), while Long.fromNumber
// gives signed Longs. We don't care about that flag — the numeric value is
// what matters, so flatten to strings for the assertion.
function longStrings(value: Long[] | null | undefined): string[] {
  return (value ?? []).map(v => v.toString());
}

function makeUpdateData(overrides: Partial<NodeUpdateData> = {}): NodeUpdateData {
  return {
    ...makeNodeData(),
    nodeId: '3',
    ...overrides,
  };
}

describe('createNodeCreateTransaction — associatedRegisteredNodes', () => {
  test('empty list defaults the SDK field to [] and produces no entries', () => {
    const tx = createNodeCreateTransaction({ ...common, ...makeNodeData() });
    // SDK always exposes an array on NodeCreate (default []), even when never set.
    expect(tx.associatedRegisteredNodes).toEqual([]);
  });

  test('non-empty list is set on the transaction as Longs', () => {
    const tx = createNodeCreateTransaction({
      ...common,
      ...makeNodeData({ associatedRegisteredNodes: ['1', '7', '12'] }),
    });
    expect(tx.associatedRegisteredNodes).toEqual(longs([1, 7, 12]));
  });
});

describe('createNodeUpdateTransaction — associatedRegisteredNodes', () => {
  test('unchanged list does not set the SDK field (left as null = no change on the wire)', () => {
    const tx = createNodeUpdateTransaction(
      {
        ...common,
        ...makeUpdateData({ associatedRegisteredNodes: ['1', '2'] }),
      },
      makeOldNodeInfo({ associated_registered_nodes: [1, 2] }),
    );
    expect(tx.associatedRegisteredNodes).toBeNull();
  });

  test('clearing a previously non-empty list sets the SDK field to []', () => {
    const tx = createNodeUpdateTransaction(
      {
        ...common,
        ...makeUpdateData({ associatedRegisteredNodes: [] }),
      },
      makeOldNodeInfo({ associated_registered_nodes: [1, 2] }),
    );
    expect(tx.associatedRegisteredNodes).toEqual([]);
  });

  test('modifying the list sets the new Longs', () => {
    const tx = createNodeUpdateTransaction(
      {
        ...common,
        ...makeUpdateData({ associatedRegisteredNodes: ['3', '4'] }),
      },
      makeOldNodeInfo({ associated_registered_nodes: [1, 2] }),
    );
    expect(tx.associatedRegisteredNodes).toEqual(longs([3, 4]));
  });

  test('adding to a previously empty list sets the new Longs', () => {
    const tx = createNodeUpdateTransaction(
      {
        ...common,
        ...makeUpdateData({ associatedRegisteredNodes: ['5'] }),
      },
      makeOldNodeInfo({ associated_registered_nodes: [] }),
    );
    expect(tx.associatedRegisteredNodes).toEqual(longs([5]));
  });

  test('no oldData and empty list leaves the SDK field null (no-op update)', () => {
    const tx = createNodeUpdateTransaction(
      {
        ...common,
        ...makeUpdateData({ associatedRegisteredNodes: [] }),
      },
      null,
    );
    expect(tx.associatedRegisteredNodes).toBeNull();
  });
});

// End-to-end: build → freeze → serialize → deserialize → inspect. This
// exercises the full path that produces a real transaction, and proves the
// field actually survives proto encoding (and gets decoded into the right
// shape on the other end). Anything that asserts only on the in-memory SDK
// object would miss a wire-format regression.
describe('NodeCreate proto roundtrip — associatedRegisteredNodes', () => {
  function freezeAndRoundtrip(tx: NodeCreateTransaction): NodeCreateTransaction {
    tx.setNodeAccountIds([new AccountId(0, 0, 3)]);
    tx.freeze();
    const decoded = Transaction.fromBytes(tx.toBytes());
    expect(decoded).toBeInstanceOf(NodeCreateTransaction);
    return decoded as NodeCreateTransaction;
  }

  test('values survive a build → freeze → fromBytes round trip', () => {
    const built = createNodeCreateTransaction({
      ...common,
      ...makeNodeData({ associatedRegisteredNodes: ['1', '7', '12'] }),
    });
    const decoded = freezeAndRoundtrip(built);
    expect(longStrings(decoded.associatedRegisteredNodes)).toEqual(['1', '7', '12']);
  });

  test('empty list round-trips as an empty list on the wire', () => {
    const built = createNodeCreateTransaction({ ...common, ...makeNodeData() });
    const decoded = freezeAndRoundtrip(built);
    expect(decoded.associatedRegisteredNodes).toEqual([]);
  });
});

describe('NodeUpdate proto roundtrip — associatedRegisteredNodes', () => {
  function freezeAndRoundtrip(tx: NodeUpdateTransaction): NodeUpdateTransaction {
    tx.setNodeAccountIds([new AccountId(0, 0, 3)]);
    tx.freeze();
    const decoded = Transaction.fromBytes(tx.toBytes());
    expect(decoded).toBeInstanceOf(NodeUpdateTransaction);
    return decoded as NodeUpdateTransaction;
  }

  test('unchanged list: the wrapper is absent (null after decode) — "no change" on the wire', () => {
    const built = createNodeUpdateTransaction(
      {
        ...common,
        ...makeUpdateData({ associatedRegisteredNodes: ['1', '2'] }),
      },
      makeOldNodeInfo({ associated_registered_nodes: [1, 2] }),
    );
    const decoded = freezeAndRoundtrip(built);
    expect(decoded.associatedRegisteredNodes).toBeNull();
  });

  test('cleared list: the wrapper is present with an empty array — "clear" on the wire', () => {
    const built = createNodeUpdateTransaction(
      {
        ...common,
        ...makeUpdateData({ associatedRegisteredNodes: [] }),
      },
      makeOldNodeInfo({ associated_registered_nodes: [1, 2] }),
    );
    const decoded = freezeAndRoundtrip(built);
    expect(decoded.associatedRegisteredNodes).toEqual([]);
  });

  test('modified list: new values are present after decode', () => {
    const built = createNodeUpdateTransaction(
      {
        ...common,
        ...makeUpdateData({ associatedRegisteredNodes: ['3', '4'] }),
      },
      makeOldNodeInfo({ associated_registered_nodes: [1, 2] }),
    );
    const decoded = freezeAndRoundtrip(built);
    expect(longStrings(decoded.associatedRegisteredNodes)).toEqual(['3', '4']);
  });
});
