// @vitest-environment node
import { describe, expect, test } from 'vitest';
import {
  AccountAllowanceApproveTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountId,
  AccountUpdateTransaction,
  BlockNodeServiceEndpoint,
  FileAppendTransaction,
  FileCreateTransaction,
  FileUpdateTransaction,
  FreezeTransaction,
  FreezeType,
  GeneralServiceEndpoint,
  Hbar,
  KeyList,
  MirrorNodeServiceEndpoint,
  NodeCreateTransaction,
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  PrivateKey,
  RegisteredNodeCreateTransaction,
  RegisteredNodeDeleteTransaction,
  RegisteredNodeUpdateTransaction,
  RpcRelayServiceEndpoint,
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
  Timestamp,
  Transaction,
  Transfer,
  TransferTransaction,
} from '@hiero-ledger/sdk';
import Long from 'long';

import { MEMO_MAX_LENGTH } from '@shared/constants';
import type { IAccountInfoParsed, INodeInfoParsed } from '@shared/interfaces';

import {
  createAccountCreateTransaction,
  createAccountDeleteTransaction,
  createAccountUpdateTransaction,
  createApproveHbarAllowanceTransaction,
  createFileAppendTransaction,
  createFileCreateDataOnlyTransaction,
  createFileCreateTransaction,
  createFileUpdateTransaction,
  createFreezeTransaction,
  createNodeCreateTransaction,
  createNodeDeleteTransaction,
  createNodeUpdateTransaction,
  createRegisteredNodeCreateTransaction,
  createRegisteredNodeDeleteTransaction,
  createRegisteredNodeUpdateTransaction,
  createSystemDeleteTransaction,
  createSystemUndeleteTransaction,
  createTransactionId,
  createTransferHbarTransaction,
  type AccountCreateData,
  type AccountUpdateData,
  type ComponentRegisteredServiceEndpoint,
  type FileAppendData,
  type FileData,
  type FileUpdateData,
  type FreezeData,
  type NodeData,
  type NodeUpdateData,
  type TransactionCommonData,
} from '@renderer/utils/sdk/createTransactions';
import {
  getFreezeData,
  getNodeData,
  getNodeDeleteData,
  getNodeUpdateData,
  getSystemDeleteData,
  getSystemUndeleteData,
} from '@renderer/utils/sdk/getData';

const common: TransactionCommonData = {
  payerId: '0.0.2',
  validStart: new Date(Date.now() + 60_000),
  maxTransactionFee: new Hbar(2),
  transactionMemo: '',
};

// Serialising requires a frozen tx with node account ids; the transaction id comes from common data.
function roundtrip<T extends Transaction>(tx: T): T {
  tx.setNodeAccountIds([AccountId.fromString('0.0.3')]);
  tx.freeze();
  return Transaction.fromBytes(tx.toBytes()) as T;
}
function fileData(contents: string | Uint8Array): FileData {
  return {
    ownerKey: null,
    fileMemo: '',
    expirationTime: null,
    contents,
  };
}

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

function makeOldNodeInfo(overrides: Partial<INodeInfoParsed> = {}): INodeInfoParsed {
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

/* ------------------------------------------------------------------ */
/* createTransactionId + common data                                   */
/* ------------------------------------------------------------------ */
describe('createTransactionId', () => {
  test('uses the payer and a future valid start as given', () => {
    const start = new Date(Date.now() + 60_000);
    const id = createTransactionId('0.0.2', start);
    expect(id.accountId?.toString()).toBe('0.0.2');
    expect(id.validStart?.toDate().getTime()).toBe(start.getTime());
  });

  test('accepts an AccountId instance and a date string', () => {
    const start = new Date(Date.now() + 60_000);
    const id = createTransactionId(AccountId.fromString('0.0.7'), start.toISOString());
    expect(id.accountId?.toString()).toBe('0.0.7');
    expect(id.validStart?.toDate().getTime()).toBe(start.getTime());
  });

  test('bumps a valid start whose 3 minute window has already passed to "now"', () => {
    const before = Date.now();
    const id = createTransactionId('0.0.2', new Date('2020-01-01T00:00:00Z'));
    expect(id.validStart!.toDate().getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  test('generates a valid start when none is provided', () => {
    const id = createTransactionId('0.0.2', null);
    expect(id.validStart).toBeInstanceOf(Timestamp);
  });
});

describe('common transaction data (applied by every creator)', () => {
  const build = (overrides: Partial<TransactionCommonData> = {}) =>
    createAccountDeleteTransaction({
      ...common,
      ...overrides,
      accountId: '',
      transferAccountId: '',
    });

  test('sets transaction id, valid duration and max fee', () => {
    const tx = build({ maxTransactionFee: new Hbar(5) });
    expect(tx.transactionId?.accountId?.toString()).toBe('0.0.2');
    expect(tx.transactionValidDuration).toBe(180);
    expect(tx.maxTransactionFee?.toTinybars().toString()).toBe(new Hbar(5).toTinybars().toString());
  });

  test('sets the memo when within the max length', () => {
    expect(build({ transactionMemo: 'hello' }).transactionMemo).toBe('hello');
  });

  test('ignores an empty memo and a memo longer than the max length', () => {
    expect(build({ transactionMemo: '' }).transactionMemo).toBe('');
    expect(build({ transactionMemo: 'x'.repeat(MEMO_MAX_LENGTH + 1) }).transactionMemo).toBe('');
  });

  test('does not set a transaction id for an invalid payer', () => {
    expect(build({ payerId: 'nope' }).transactionId).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */
const accountData = (overrides: Partial<AccountCreateData> = {}): AccountCreateData => ({
  receiverSignatureRequired: false,
  declineStakingReward: false,
  maxAutomaticTokenAssociations: 0,
  accountMemo: '',
  stakeType: 'None',
  stakedAccountId: '',
  stakedNodeId: null,
  ownerKey: null,
  initialBalance: null,
  ...overrides,
});

describe('createAccountCreateTransaction', () => {
  test('defaults the initial balance to 0 and leaves the key unset', () => {
    const tx = createAccountCreateTransaction({ ...common, ...accountData() });
    expect(tx).toBeInstanceOf(AccountCreateTransaction);
    expect(tx.initialBalance?.toTinybars().toNumber()).toBe(0);
    expect(tx.key).toBeNull();
  });

  test('carries flags, memo, balance and owner key through serialisation', () => {
    const key = PrivateKey.generateED25519().publicKey;
    const tx = roundtrip(
      createAccountCreateTransaction({
        ...common,
        ...accountData({
          receiverSignatureRequired: true,
          declineStakingReward: true,
          maxAutomaticTokenAssociations: 5,
          accountMemo: 'my account',
          initialBalance: new Hbar(10),
          ownerKey: key,
        }),
      }),
    );
    expect(tx.receiverSignatureRequired).toBe(true);
    expect(tx.declineStakingRewards).toBe(true);
    expect(tx.maxAutomaticTokenAssociations?.toNumber()).toBe(5);
    expect(tx.accountMemo).toBe('my account');
    expect(tx.initialBalance?.toBigNumber().toNumber()).toBe(10);
    expect(tx.key?.toString()).toBe(key.toString());
  });

  test('accepts a complex (threshold) owner key', () => {
    const keys = [1, 2, 3].map(() => PrivateKey.generateED25519().publicKey);
    const tx = roundtrip(
      createAccountCreateTransaction({
        ...common,
        ...accountData({ ownerKey: new KeyList(keys, 2) }),
      }),
    );
    expect(tx.key).toBeInstanceOf(KeyList);
    expect((tx.key as KeyList).threshold).toBe(2);
    expect((tx.key as KeyList).toArray()).toHaveLength(3);
  });

  test('stakes to an account when stakeType is Account and the id is valid', () => {
    const tx = createAccountCreateTransaction({
      ...common,
      ...accountData({ stakeType: 'Account', stakedAccountId: '0.0.9' }),
    });
    expect(tx.stakedAccountId?.toString()).toBe('0.0.9');
    expect(tx.stakedNodeId).toBeNull();
  });

  test('ignores an invalid staked account id', () => {
    const tx = createAccountCreateTransaction({
      ...common,
      ...accountData({ stakeType: 'Account', stakedAccountId: 'bad' }),
    });
    expect(tx.stakedAccountId).toBeNull();
  });

  test('stakes to a node when stakeType is Node (including node 0)', () => {
    const tx = createAccountCreateTransaction({
      ...common,
      ...accountData({ stakeType: 'Node', stakedNodeId: 0 }),
    });
    expect(tx.stakedNodeId?.toString()).toBe('0');
    expect(tx.stakedAccountId).toBeNull();
  });

  test('does not stake when stakeType is None even if ids are filled in', () => {
    const tx = createAccountCreateTransaction({
      ...common,
      ...accountData({ stakeType: 'None', stakedAccountId: '0.0.9', stakedNodeId: 3 }),
    });
    expect(tx.stakedAccountId).toBeNull();
    expect(tx.stakedNodeId).toBeNull();
  });
});

describe('createApproveHbarAllowanceTransaction', () => {
  test('adds an hbar allowance for valid owner and spender', () => {
    const tx = createApproveHbarAllowanceTransaction({
      ...common,
      ownerAccountId: '0.0.10',
      spenderAccountId: '0.0.11',
      amount: new Hbar(3),
    });
    expect(tx).toBeInstanceOf(AccountAllowanceApproveTransaction);
    expect(tx.hbarApprovals).toHaveLength(1);
    expect(tx.hbarApprovals[0].ownerAccountId?.toString()).toBe('0.0.10');
    expect(tx.hbarApprovals[0].spenderAccountId?.toString()).toBe('0.0.11');
    expect(tx.hbarApprovals[0].amount?.toBigNumber().toNumber()).toBe(3);
  });

  test.each([
    ['owner', { ownerAccountId: 'bad', spenderAccountId: '0.0.11' }],
    ['spender', { ownerAccountId: '0.0.10', spenderAccountId: 'bad' }],
  ])('adds nothing when the %s id is invalid', (_n, ids) => {
    const tx = createApproveHbarAllowanceTransaction({ ...common, ...ids, amount: new Hbar(3) });
    expect(tx.hbarApprovals).toHaveLength(0);
  });
});

describe('createAccountDeleteTransaction', () => {
  test('sets the account and transfer account', () => {
    const tx = roundtrip(
      createAccountDeleteTransaction({
        ...common,
        accountId: '0.0.20',
        transferAccountId: '0.0.21',
      }),
    );
    expect(tx).toBeInstanceOf(AccountDeleteTransaction);
    expect(tx.accountId?.toString()).toBe('0.0.20');
    expect(tx.transferAccountId?.toString()).toBe('0.0.21');
  });

  test('ignores invalid ids', () => {
    const tx = createAccountDeleteTransaction({
      ...common,
      accountId: 'x',
      transferAccountId: 'y',
    });
    expect(tx.accountId).toBeNull();
    expect(tx.transferAccountId).toBeNull();
  });
});

describe('createAccountUpdateTransaction', () => {
  const ownerKey = PrivateKey.generateED25519().publicKey;

  const updateData = (
    overrides: Partial<AccountUpdateData> = {},
  ): TransactionCommonData & AccountUpdateData => ({
    ...common,
    ...accountData({ ownerKey }),
    accountId: '0.0.30',
    ...overrides,
  });

  const oldInfo = (overrides: Partial<IAccountInfoParsed> = {}): IAccountInfoParsed =>
    ({
      accountId: AccountId.fromString('0.0.30'),
      declineReward: false,
      key: ownerKey,
      maxAutomaticTokenAssociations: 0,
      memo: '',
      receiverSignatureRequired: false,
      stakedAccountId: null,
      stakedNodeId: null,
      ...overrides,
    }) as unknown as IAccountInfoParsed;

  test('without old data writes the account id, flags, memo and key', () => {
    const tx = createAccountUpdateTransaction(
      updateData({ receiverSignatureRequired: true, accountMemo: 'new memo' }),
      null,
    );
    expect(tx).toBeInstanceOf(AccountUpdateTransaction);
    expect(tx.accountId?.toString()).toBe('0.0.30');
    expect(tx.receiverSignatureRequired).toBe(true);
    expect(tx.accountMemo).toBe('new memo');
    expect(tx.key?.toString()).toBe(ownerKey.toString());
  });

  test('with identical old data writes nothing but the account id', () => {
    const tx = createAccountUpdateTransaction(updateData(), oldInfo());
    expect(tx.accountId?.toString()).toBe('0.0.30');
    expect(tx.receiverSignatureRequired).toBeNull();
    expect(tx.declineStakingRewards).toBeNull();
    expect(tx.maxAutomaticTokenAssociations).toBeNull();
    expect(tx.accountMemo).toBeNull();
    expect(tx.key).toBeNull();
  });

  test('only writes the fields that changed', () => {
    const tx = createAccountUpdateTransaction(
      updateData({ declineStakingReward: true, maxAutomaticTokenAssociations: 7 }),
      oldInfo(),
    );
    expect(tx.declineStakingRewards).toBe(true);
    expect(tx.maxAutomaticTokenAssociations?.toNumber()).toBe(7);
    expect(tx.receiverSignatureRequired).toBeNull();
    expect(tx.key).toBeNull();
  });

  test('writes the key when it differs from the old key', () => {
    const newKey = PrivateKey.generateED25519().publicKey;
    const tx = createAccountUpdateTransaction(updateData({ ownerKey: newKey }), oldInfo());
    expect(tx.key?.toString()).toBe(newKey.toString());
  });

  test('clearing the memo writes an empty memo', () => {
    const tx = createAccountUpdateTransaction(
      updateData({ accountMemo: '' }),
      oldInfo({ memo: 'old' }),
    );
    expect(tx.accountMemo).toBe('');
  });

  test('stake to a new account', () => {
    const tx = createAccountUpdateTransaction(
      updateData({ stakeType: 'Account', stakedAccountId: '0.0.40' }),
      oldInfo(),
    );
    expect(tx.stakedAccountId?.toString()).toBe('0.0.40');
  });

  test('unchanged staked account is not rewritten', () => {
    const tx = createAccountUpdateTransaction(
      updateData({ stakeType: 'Account', stakedAccountId: '0.0.40' }),
      oldInfo({ stakedAccountId: AccountId.fromString('0.0.40') }),
    );
    expect(tx.stakedAccountId).toBeNull();
  });

  test('Account stake with an empty or 0.0.0 id clears the staked account', () => {
    for (const stakedAccountId of ['', '0.0.0']) {
      const tx = createAccountUpdateTransaction(
        updateData({ stakeType: 'Account', stakedAccountId }),
        oldInfo({ stakedAccountId: AccountId.fromString('0.0.40') }),
      );
      expect(tx.stakedAccountId?.toString()).toBe('0.0.0');
    }
  });

  test('stake to a node, and clear it when the node id is null', () => {
    const set = createAccountUpdateTransaction(
      updateData({ stakeType: 'Node', stakedNodeId: 4 }),
      oldInfo(),
    );
    expect(set.stakedNodeId?.toString()).toBe('4');

    const cleared = createAccountUpdateTransaction(
      updateData({ stakeType: 'Node', stakedNodeId: null }),
      oldInfo({ stakedNodeId: 4 }),
    );
    expect(cleared.stakedNodeId?.toString()).toBe('-1');
  });

  test('stakeType None clears an existing account stake', () => {
    const tx = createAccountUpdateTransaction(
      updateData({ stakeType: 'None' }),
      oldInfo({ stakedAccountId: AccountId.fromString('0.0.40') }),
    );
    expect(tx.stakedAccountId?.toString()).toBe('0.0.0');
  });

  test('round-trips through serialisation', () => {
    const tx = roundtrip(createAccountUpdateTransaction(updateData({ accountMemo: 'm' }), null));
    expect(tx.accountId?.toString()).toBe('0.0.30');
    expect(tx.accountMemo).toBe('m');
  });
});

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */
describe('File Create / Update / Append — contents', () => {
  test('sets string contents on file create transactions', () => {
    const contents = 'hello world';

    const transaction = createFileCreateTransaction({
      ...common,
      ...fileData(contents),
    });

    expect(Array.from(transaction.contents ?? [])).toEqual(
      Array.from(new TextEncoder().encode(contents)),
    );
  });

  test('sets string contents on file update transactions', () => {
    const contents = 'hello world';
    const data: TransactionCommonData & FileUpdateData = {
      ...common,
      ...fileData(contents),
      fileId: '0.0.150',
    };

    const transaction = createFileUpdateTransaction(data);

    expect(Array.from(transaction.contents ?? [])).toEqual(
      Array.from(new TextEncoder().encode(contents)),
    );
  });

  test('sets string contents on file append transactions', () => {
    const contents = 'hello world';
    const data: TransactionCommonData & FileAppendData = {
      ...common,
      fileId: '0.0.150',
      chunkSize: 1024,
      maxChunks: 1,
      contents,
    };

    const transaction = createFileAppendTransaction(data);

    expect(Array.from(transaction.contents ?? [])).toEqual(
      Array.from(new TextEncoder().encode(contents)),
    );
  });
});

describe('createFileCreateTransaction / createFileCreateDataOnlyTransaction / createFileUpdateTransaction — file info', () => {
  const key = PrivateKey.generateED25519().publicKey;
  const info = (overrides: Partial<FileData> = {}): FileData => ({
    ...fileData('abc'),
    ...overrides,
  });

  test('wraps a single owner key in a key list', () => {
    const tx = createFileCreateTransaction({ ...common, ...info({ ownerKey: key }) });
    expect(tx).toBeInstanceOf(FileCreateTransaction);
    expect(tx.keys?.map(k => k.toString())).toEqual([key.toString()]);
  });

  test('uses a key list owner key as is', () => {
    const list = new KeyList([key, PrivateKey.generateED25519().publicKey]);
    const tx = createFileCreateTransaction({ ...common, ...info({ ownerKey: list }) });
    expect(tx.keys).toHaveLength(2);
  });

  test('sets memo and expiration time', () => {
    const exp = new Date('2030-01-01T00:00:00Z');
    const tx = createFileCreateTransaction({
      ...common,
      ...info({ fileMemo: 'memo', expirationTime: exp }),
    });
    expect(tx.fileMemo).toBe('memo');
    expect(tx.expirationTime?.toDate().toISOString()).toBe(exp.toISOString());
  });

  test('ignores an over-long memo and empty contents', () => {
    const tx = createFileCreateTransaction({
      ...common,
      ...info({ fileMemo: 'x'.repeat(MEMO_MAX_LENGTH + 1), contents: '' }),
    });
    expect(tx.fileMemo).toBeNull();
    expect(tx.contents).toBeNull();
  });

  test('data-only variant carries file info but no common transaction data', () => {
    const tx = createFileCreateDataOnlyTransaction(info({ fileMemo: 'memo' }));
    expect(tx.fileMemo).toBe('memo');
    expect(tx.transactionId).toBeNull();
  });

  test('update sets the file id and ignores an invalid one', () => {
    const data: FileUpdateData = { ...info(), fileId: '0.0.150' };
    const tx = createFileUpdateTransaction({ ...common, ...data });
    expect(tx).toBeInstanceOf(FileUpdateTransaction);
    expect(tx.fileId?.toString()).toBe('0.0.150');
    expect(createFileUpdateTransaction({ ...common, ...data, fileId: 'bad' }).fileId).toBeNull();
  });

  test('byte contents are preserved', () => {
    const bytes = Uint8Array.from([1, 2, 3, 255]);
    const tx = createFileCreateTransaction({ ...common, ...info({ contents: bytes }) });
    expect(Array.from(tx.contents ?? [])).toEqual([1, 2, 3, 255]);
  });
});

describe('createFileAppendTransaction — options', () => {
  const data = (overrides: Partial<FileAppendData> = {}): FileAppendData => ({
    fileId: '0.0.150',
    chunkSize: 1024,
    maxChunks: 5,
    contents: 'abc',
    ...overrides,
  });

  test('sets file id, chunk size and max chunks', () => {
    const tx = createFileAppendTransaction({ ...common, ...data() });
    expect(tx).toBeInstanceOf(FileAppendTransaction);
    expect(tx.fileId?.toString()).toBe('0.0.150');
    expect(tx.chunkSize).toBe(1024);
    expect(tx.maxChunks).toBe(5);
  });

  test('ignores an invalid file id and empty contents', () => {
    const tx = createFileAppendTransaction({ ...common, ...data({ fileId: 'bad', contents: '' }) });
    expect(tx.fileId).toBeNull();
    expect(tx.contents).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Transfer                                                            */
/* ------------------------------------------------------------------ */
describe('createTransferHbarTransaction', () => {
  const transfer = (accountId: string, hbars: number, isApproved = false) =>
    new Transfer({ accountId, amount: new Hbar(hbars), isApproved });

  test('adds every transfer with its amount', () => {
    const tx = roundtrip(
      createTransferHbarTransaction({
        ...common,
        transfers: [transfer('0.0.2', -5), transfer('0.0.50', 5)],
      }),
    );
    expect(tx).toBeInstanceOf(TransferTransaction);
    const list = tx.hbarTransfersList;
    expect(list).toHaveLength(2);
    expect(list.map(t => [t.accountId.toString(), t.amount.toBigNumber().toNumber()])).toEqual([
      ['0.0.2', -5],
      ['0.0.50', 5],
    ]);
  });

  test('marks approved transfers as approved', () => {
    const tx = createTransferHbarTransaction({
      ...common,
      transfers: [transfer('0.0.2', -5, true), transfer('0.0.50', 5)],
    });
    const byAccount = Object.fromEntries(
      tx.hbarTransfersList.map(t => [t.accountId.toString(), t.isApproved]),
    );
    expect(byAccount).toEqual({ '0.0.2': true, '0.0.50': false });
  });

  test('no transfers yields an empty transaction', () => {
    expect(createTransferHbarTransaction({ ...common, transfers: [] }).hbarTransfersList).toEqual(
      [],
    );
  });
});

/* ------------------------------------------------------------------ */
/* Nodes, Freeze, System                                               */
/* ------------------------------------------------------------------ */
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

const HASH = 'ab'.repeat(48);

function freezeData(overrides: Partial<FreezeData> = {}): FreezeData {
  return {
    freezeType: FreezeType.FreezeOnly._code,
    startTimestamp: new Date('2026-06-01T12:00:00Z'),
    fileId: '',
    fileHash: '',
    ...overrides,
  };
}

describe('createFreezeTransaction', () => {
  test('FreezeOnly: sets type + start time, ignores file info', () => {
    const tx = roundtrip(
      createFreezeTransaction({
        ...common,
        ...freezeData({ fileId: '0.0.150', fileHash: HASH }),
      }),
    );
    expect(tx).toBeInstanceOf(FreezeTransaction);
    const parsed = getFreezeData(tx);
    expect(parsed.freezeType).toBe(FreezeType.FreezeOnly._code);
    expect(parsed.startTimestamp.toISOString()).toBe('2026-06-01T12:00:00.000Z');
    expect(parsed.fileId).toBe('');
    expect(parsed.fileHash).toBe('');
  });

  test('PrepareUpgrade: sets file id + hash, no start time', () => {
    const tx = roundtrip(
      createFreezeTransaction({
        ...common,
        ...freezeData({
          freezeType: FreezeType.PrepareUpgrade._code,
          fileId: '0.0.150',
          fileHash: HASH,
        }),
      }),
    );
    const parsed = getFreezeData(tx);
    expect(parsed.freezeType).toBe(FreezeType.PrepareUpgrade._code);
    expect(parsed.fileId).toBe('0.0.150');
    expect(parsed.fileHash).toBe(HASH);
    expect(tx.startTimestamp).toBeNull();
  });

  test('FreezeUpgrade: sets start time, file id and hash', () => {
    const tx = roundtrip(
      createFreezeTransaction({
        ...common,
        ...freezeData({
          freezeType: FreezeType.FreezeUpgrade._code,
          fileId: '0.0.150',
          fileHash: HASH,
        }),
      }),
    );
    const parsed = getFreezeData(tx);
    expect(parsed.freezeType).toBe(FreezeType.FreezeUpgrade._code);
    expect(parsed.startTimestamp.toISOString()).toBe('2026-06-01T12:00:00.000Z');
    expect(parsed.fileId).toBe('0.0.150');
    expect(parsed.fileHash).toBe(HASH);
  });

  test('FreezeAbort: only the type is set', () => {
    const tx = roundtrip(
      createFreezeTransaction({
        ...common,
        ...freezeData({
          freezeType: FreezeType.FreezeAbort._code,
          fileId: '0.0.150',
          fileHash: HASH,
        }),
      }),
    );
    expect(getFreezeData(tx).freezeType).toBe(FreezeType.FreezeAbort._code);
    expect(tx.fileId).toBeNull();
    expect(tx.fileHash?.length ?? 0).toBe(0);
    expect(tx.startTimestamp).toBeNull();
  });

  test('unset freeze type (-1) produces no type on the transaction', () => {
    const tx = createFreezeTransaction({ ...common, ...freezeData({ freezeType: -1 }) });
    expect(tx.freezeType).toBeNull();
  });

  test('file id 0.0.0 is not written', () => {
    const tx = createFreezeTransaction({
      ...common,
      ...freezeData({
        freezeType: FreezeType.PrepareUpgrade._code,
        fileId: '0.0.0',
        fileHash: HASH,
      }),
    });
    expect(tx.fileId).toBeNull();
  });

  test('getFreezeData rejects other transaction types', () => {
    expect(() => getFreezeData(new NodeDeleteTransaction())).toThrow();
  });
});

describe('createSystemDeleteTransaction', () => {
  test('file target round-trips with expiration time', () => {
    const tx = roundtrip(
      createSystemDeleteTransaction({
        ...common,
        fileId: '0.0.150',
        contractId: '',
        expirationTime: new Date('2026-07-01T00:00:00Z'),
      }),
    );
    expect(tx).toBeInstanceOf(SystemDeleteTransaction);
    expect(getSystemDeleteData(tx)).toEqual({
      fileId: '0.0.150',
      contractId: '',
      expirationTime: new Date('2026-07-01T00:00:00Z'),
    });
  });

  test('contract target round-trips', () => {
    const tx = roundtrip(
      createSystemDeleteTransaction({
        ...common,
        fileId: '',
        contractId: '0.0.1234',
        expirationTime: new Date('2026-07-01T00:00:00Z'),
      }),
    );
    const parsed = getSystemDeleteData(tx);
    expect(parsed.contractId).toBe('0.0.1234');
    expect(parsed.fileId).toBe('');
  });

  test('missing expiration time yields null', () => {
    const tx = roundtrip(
      createSystemDeleteTransaction({
        ...common,
        fileId: '0.0.150',
        contractId: '',
        expirationTime: null,
      }),
    );
    expect(getSystemDeleteData(tx).expirationTime).toBeNull();
  });

  test('invalid ids are ignored rather than written', () => {
    const tx = createSystemDeleteTransaction({
      ...common,
      fileId: 'nope',
      contractId: 'nope',
      expirationTime: null,
    });
    expect(tx.fileId).toBeNull();
    expect(tx.contractId).toBeNull();
  });

  test('getSystemDeleteData rejects other transaction types', () => {
    expect(() => getSystemDeleteData(new SystemUndeleteTransaction())).toThrow();
  });
});

describe('createSystemUndeleteTransaction', () => {
  test('file target round-trips', () => {
    const tx = roundtrip(
      createSystemUndeleteTransaction({ ...common, fileId: '0.0.150', contractId: '' }),
    );
    expect(tx).toBeInstanceOf(SystemUndeleteTransaction);
    expect(getSystemUndeleteData(tx)).toEqual({ fileId: '0.0.150', contractId: '' });
  });

  test('contract target round-trips', () => {
    const tx = roundtrip(
      createSystemUndeleteTransaction({ ...common, fileId: '', contractId: '0.0.1234' }),
    );
    expect(getSystemUndeleteData(tx)).toEqual({ fileId: '', contractId: '0.0.1234' });
  });

  test('getSystemUndeleteData rejects other transaction types', () => {
    expect(() => getSystemUndeleteData(new SystemDeleteTransaction())).toThrow();
  });
});

describe('createNodeDeleteTransaction', () => {
  test('node id round-trips', () => {
    const tx = roundtrip(createNodeDeleteTransaction({ ...common, nodeId: '7' }));
    expect(tx).toBeInstanceOf(NodeDeleteTransaction);
    expect(getNodeDeleteData(tx)).toEqual({ nodeId: '7' });
  });

  test('node id 0 is not written (falsy string check is on "0", which is truthy)', () => {
    const tx = roundtrip(createNodeDeleteTransaction({ ...common, nodeId: '0' }));
    expect(getNodeDeleteData(tx).nodeId).toBe('0');
  });

  test('empty node id leaves the field unset', () => {
    const tx = createNodeDeleteTransaction({ ...common, nodeId: '' });
    expect(tx.nodeId).toBeNull();
  });

  test('getNodeDeleteData rejects other transaction types', () => {
    expect(() => getNodeDeleteData(new NodeCreateTransaction())).toThrow();
  });
});

describe('createNodeCreateTransaction / createNodeUpdateTransaction — full payload', () => {
  const adminKey = PrivateKey.generateED25519().publicKey;
  const cert = Uint8Array.from([1, 2, 3, 4]);
  const certHash = Uint8Array.from([9, 8, 7, 6]);

  const nodeData: NodeData = {
    nodeAccountId: '0.0.5',
    description: 'my node',
    gossipEndpoints: [
      { ipAddressV4: '10.0.0.1', domainName: '', port: '50111' },
      { ipAddressV4: '', domainName: 'gossip.example.com', port: '50112' },
    ],
    serviceEndpoints: [{ ipAddressV4: '10.0.0.2', domainName: '', port: '50211' }],
    grpcWebProxyEndpoint: { ipAddressV4: '', domainName: 'proxy.example.com', port: '443' },
    gossipCaCertificate: cert,
    certificateHash: certHash,
    adminKey,
    declineReward: true,
    associatedRegisteredNodes: ['2', '4'],
  };

  test('NodeCreate preserves every field through serialisation', () => {
    const tx = roundtrip(createNodeCreateTransaction({ ...common, ...nodeData }));
    expect(tx).toBeInstanceOf(NodeCreateTransaction);
    const parsed = getNodeData(tx);

    expect(parsed.nodeAccountId).toBe('0.0.5');
    expect(parsed.description).toBe('my node');
    expect(parsed.gossipEndpoints).toEqual(nodeData.gossipEndpoints);
    expect(parsed.serviceEndpoints).toEqual(nodeData.serviceEndpoints);
    expect(parsed.grpcWebProxyEndpoint).toEqual(nodeData.grpcWebProxyEndpoint);
    expect(Array.from(parsed.gossipCaCertificate)).toEqual(Array.from(cert));
    expect(Array.from(parsed.certificateHash)).toEqual(Array.from(certHash));
    expect(parsed.adminKey?.toString()).toBe(adminKey.toString());
    expect(parsed.declineReward).toBe(true);
    expect(parsed.associatedRegisteredNodes).toEqual(['2', '4']);
  });

  test('NodeCreate with only required fields leaves optional ones empty', () => {
    const tx = roundtrip(
      createNodeCreateTransaction({
        ...common,
        ...nodeData,
        description: '',
        grpcWebProxyEndpoint: null,
        certificateHash: Uint8Array.from([]),
        declineReward: false,
        associatedRegisteredNodes: [],
      }),
    );
    const parsed = getNodeData(tx);
    expect(parsed.grpcWebProxyEndpoint).toBeNull();
    expect(parsed.certificateHash.length).toBe(0);
    expect(parsed.declineReward).toBe(false);
  });

  test('NodeUpdate with no old data writes the full payload and node id', () => {
    const tx = roundtrip(
      createNodeUpdateTransaction({ ...common, ...nodeData, nodeId: '5' }, null),
    );
    expect(tx).toBeInstanceOf(NodeUpdateTransaction);
    const parsed = getNodeUpdateData(tx);
    expect(parsed.nodeId).toBe('5');
    expect(parsed.nodeAccountId).toBe('0.0.5');
    expect(parsed.serviceEndpoints).toEqual(nodeData.serviceEndpoints);
    expect(parsed.adminKey?.toString()).toBe(adminKey.toString());
  });

  test('NodeUpdate only writes fields that differ from the current node info', () => {
    const old = {
      admin_key: adminKey,
      description: 'my node',
      file_id: null,
      memo: null,
      node_id: 5,
      node_account_id: AccountId.fromString('0.0.5'),
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
      decline_reward: true,
      grpc_web_proxy_endpoint: null,
      associated_registered_nodes: [2, 4],
    };
    const tx = createNodeUpdateTransaction(
      { ...common, ...nodeData, description: 'renamed', nodeId: '5' },
      old,
    );
    expect(tx.description).toBe('renamed');
    expect(tx.accountId).toBeNull();
    expect(tx.adminKey).toBeNull();
    expect(tx.declineReward).toBeNull();
    expect(tx.associatedRegisteredNodes).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Registered nodes (HIP-1137)                                         */
/* ------------------------------------------------------------------ */
describe('Registered node creators', () => {
  const adminKey = PrivateKey.generateED25519().publicKey;
  const ep = (
    overrides: Partial<ComponentRegisteredServiceEndpoint> = {},
  ): ComponentRegisteredServiceEndpoint => ({
    type: 'mirrorNode',
    ipAddressV4: '10.0.0.1',
    domainName: '',
    port: '443',
    requiresTls: true,
    ...overrides,
  });

  describe('createRegisteredNodeCreateTransaction', () => {
    test('sets admin key, description and one endpoint of each type', () => {
      const tx = roundtrip(
        createRegisteredNodeCreateTransaction({
          ...common,
          adminKey,
          description: 'reg node',
          serviceEndpoints: [
            ep({ type: 'blockNode' }),
            ep({ type: 'mirrorNode', ipAddressV4: '', domainName: 'mirror.example.com' }),
            ep({ type: 'rpcRelay' }),
            ep({ type: 'generalService', endpointDescription: 'general' }),
          ],
        }),
      );
      expect(tx).toBeInstanceOf(RegisteredNodeCreateTransaction);
      expect(tx.adminKey?.toString()).toBe(adminKey.toString());
      expect(tx.description).toBe('reg node');
      const endpoints = tx.serviceEndpoints;
      expect(endpoints[0]).toBeInstanceOf(BlockNodeServiceEndpoint);
      expect(endpoints[1]).toBeInstanceOf(MirrorNodeServiceEndpoint);
      expect(endpoints[2]).toBeInstanceOf(RpcRelayServiceEndpoint);
      expect(endpoints[3]).toBeInstanceOf(GeneralServiceEndpoint);
      expect(endpoints).toHaveLength(4);
    });

    test('keeps port, TLS flag and domain name on an endpoint', () => {
      const tx = roundtrip(
        createRegisteredNodeCreateTransaction({
          ...common,
          adminKey,
          description: '',
          serviceEndpoints: [
            ep({
              ipAddressV4: '',
              domainName: 'mirror.example.com',
              port: '8443',
              requiresTls: false,
            }),
          ],
        }),
      );
      const [endpoint] = tx.serviceEndpoints;
      expect(endpoint.port).toBe(8443);
      expect(endpoint.requiresTls).toBe(false);
      expect(endpoint.domainName).toBe('mirror.example.com');
    });

    test('drops malformed endpoints (bad ip, bad port, no address, unknown type)', () => {
      const tx = createRegisteredNodeCreateTransaction({
        ...common,
        adminKey,
        description: '',
        serviceEndpoints: [
          ep({ ipAddressV4: '999.1.1.1' }),
          ep({ port: 'abc' }),
          ep({ port: '70000' }),
          ep({ ipAddressV4: '', domainName: '' }),
          ep({ type: 'nope' as never }),
          ep(),
        ],
      });
      expect(tx.serviceEndpoints).toHaveLength(1);
    });

    test('omits unset admin key, description and endpoints', () => {
      const tx = createRegisteredNodeCreateTransaction({
        ...common,
        adminKey: null,
        description: '',
        serviceEndpoints: [],
      });
      expect(tx.adminKey).toBeNull();
      expect(tx.description).toBeNull();
      expect(tx.serviceEndpoints).toHaveLength(0);
    });
  });

  describe('createRegisteredNodeUpdateTransaction', () => {
    test('sets the registered node id and updated fields', () => {
      const tx = roundtrip(
        createRegisteredNodeUpdateTransaction({
          ...common,
          registeredNodeId: '12',
          adminKey,
          description: 'renamed',
          serviceEndpoints: [ep()],
        }, null),
      );
      expect(tx).toBeInstanceOf(RegisteredNodeUpdateTransaction);
      expect(tx.registeredNodeId?.toString()).toBe('12');
      expect(tx.description).toBe('renamed');
      expect(tx.adminKey?.toString()).toBe(adminKey.toString());
      expect(tx.serviceEndpoints).toHaveLength(1);
    });

    test('leaves the id unset when empty', () => {
      const tx = createRegisteredNodeUpdateTransaction(
        {
          ...common,
          registeredNodeId: '',
          adminKey: null,
          description: '',
          serviceEndpoints: [],
        },
        null,
      );
      expect(tx.registeredNodeId).toBeNull();
    });
  });

  describe('createRegisteredNodeDeleteTransaction', () => {
    test('sets the registered node id', () => {
      const tx = roundtrip(
        createRegisteredNodeDeleteTransaction({ ...common, registeredNodeId: '12' }),
      );
      expect(tx).toBeInstanceOf(RegisteredNodeDeleteTransaction);
      expect(tx.registeredNodeId?.toString()).toBe('12');
    });

    test('leaves the id unset when empty', () => {
      expect(
        createRegisteredNodeDeleteTransaction({ ...common, registeredNodeId: '' }).registeredNodeId,
      ).toBeNull();
    });
  });
});
