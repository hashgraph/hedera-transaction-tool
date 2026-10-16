// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Long from 'long';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import {
  FreezeTransaction,
  Hbar,
  NodeCreateTransaction,
  NodeDeleteTransaction,
  PrivateKey,
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
} from '@hiero-ledger/sdk';

const mockToast = { success: vi.fn(), error: vi.fn() };
const nodeInfo = ref<unknown>(null);
const nodeId = ref<number | null>(null);
const mockUser = { personal: { isLoggedIn: true, id: 'u1' } };

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => mockToast },
}));

vi.mock('@renderer/composables/useNodeId', () => ({
  default: () => ({ nodeInfo, nodeId }),
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: () => mockUser }));

vi.mock('@renderer/components/Transaction/Create/BaseTransaction', () => ({
  default: {
    name: 'BaseTransaction',
    props: ['createTransaction', 'createDisabled', 'preCreateAssert'],
    emits: ['executed:success', 'draft-loaded'],
    methods: { updateTransactionKey() {} },
    template: '<div><slot /></div>',
  },
}));

// Stub every form component: we only care about the data flowing in/out.
const { formStub } = vi.hoisted(() => ({
  formStub: (name: string) => ({
    default: { name, props: ['data', 'required'], emits: ['update:data'], template: '<div />' },
  }),
}));
vi.mock('@renderer/components/Transaction/Create/Freeze/FreezeFormData.vue', () =>
  formStub('FreezeFormData'),
);
vi.mock('@renderer/components/Transaction/Create/SystemDelete/SystemDeleteFormData.vue', () =>
  formStub('SystemDeleteFormData'),
);
vi.mock('@renderer/components/Transaction/Create/SystemUndelete/SystemUndeleteFormData.vue', () =>
  formStub('SystemUndeleteFormData'),
);
vi.mock('@renderer/components/Transaction/Create/NodeDelete/NodeDeleteFormData.vue', () =>
  formStub('NodeDeleteFormData'),
);
vi.mock('@renderer/components/Transaction/Create/NodeCreate/NodeFormData.vue', () =>
  formStub('NodeFormData'),
);

// Load the real barrel first: `@renderer/utils` <-> `@renderer/utils/sdk` is an import cycle and
// the components' `getNodeData` & co. only resolve if the barrel is fully evaluated up front.
import '@renderer/utils';

import Freeze from '@renderer/components/Transaction/Create/Freeze/Freeze.vue';
import SystemDelete from '@renderer/components/Transaction/Create/SystemDelete/SystemDelete.vue';
import SystemUndelete from '@renderer/components/Transaction/Create/SystemUndelete/SystemUndelete.vue';
import NodeDelete from '@renderer/components/Transaction/Create/NodeDelete/NodeDelete.vue';
import NodeCreate from '@renderer/components/Transaction/Create/NodeCreate/NodeCreate.vue';

const common = {
  payerId: '0.0.2',
  validStart: new Date('2026-01-01T00:00:00Z'),
  maxTransactionFee: new Hbar(2),
  transactionMemo: '',
};

type Wrapper = ReturnType<typeof mount>;
const base = (w: Wrapper) => w.findComponent({ name: 'BaseTransaction' });
const disabled = (w: Wrapper) => base(w).props('createDisabled') as boolean;
const build = (w: Wrapper) =>
  (base(w).props('createTransaction') as (c: typeof common) => unknown)(common);
const assertFn = (w: Wrapper) => base(w).props('preCreateAssert') as () => unknown;

async function fill(w: Wrapper, formName: string, overrides: Record<string, unknown>) {
  const form = w.findComponent({ name: formName });
  form.vm.$emit('update:data', { ...(form.props('data') as object), ...overrides });
  await flushPromises();
}

beforeEach(() => {
  vi.clearAllMocks();
  nodeInfo.value = null;
  nodeId.value = null;
  mockUser.personal = { isLoggedIn: true, id: 'u1' };
});

describe('5.12.1 Freeze.vue', () => {
  const HASH = 'ab'.repeat(48);
  const mountFreeze = () => mount(Freeze);

  test('disabled until a freeze type is chosen', () => {
    expect(disabled(mountFreeze())).toBe(true);
  });

  test('Freeze Only (1) is enabled with a start time and needs no file info', async () => {
    const w = mountFreeze();
    await fill(w, 'FreezeFormData', { freezeType: 1 });
    expect(disabled(w)).toBe(false);
  });

  test('Freeze Only (1) is disabled when start time is cleared', async () => {
    const w = mountFreeze();
    await fill(w, 'FreezeFormData', { freezeType: 1, startTimestamp: null });
    expect(disabled(w)).toBe(true);
  });

  test('Prepare Upgrade (2) requires a valid file id and a hash', async () => {
    const w = mountFreeze();
    await fill(w, 'FreezeFormData', { freezeType: 2 });
    expect(disabled(w)).toBe(true);
    await fill(w, 'FreezeFormData', { fileId: '0.0.150' });
    expect(disabled(w)).toBe(true);
    await fill(w, 'FreezeFormData', { fileHash: HASH });
    expect(disabled(w)).toBe(false);
    await fill(w, 'FreezeFormData', { fileId: 'bad' });
    expect(disabled(w)).toBe(true);
  });

  test('Prepare Upgrade (2) does not need a start time', async () => {
    const w = mountFreeze();
    await fill(w, 'FreezeFormData', {
      freezeType: 2,
      fileId: '0.0.150',
      fileHash: HASH,
      startTimestamp: null,
    });
    expect(disabled(w)).toBe(false);
  });

  test('Freeze Upgrade (3) requires start time, file id and hash', async () => {
    const w = mountFreeze();
    await fill(w, 'FreezeFormData', { freezeType: 3, fileId: '0.0.150', fileHash: HASH });
    expect(disabled(w)).toBe(false);
    await fill(w, 'FreezeFormData', { startTimestamp: null });
    expect(disabled(w)).toBe(true);
  });

  test('Freeze Abort (4) is enabled with nothing else', async () => {
    const w = mountFreeze();
    await fill(w, 'FreezeFormData', { freezeType: 4 });
    expect(disabled(w)).toBe(false);
  });

  test('builds a FreezeTransaction from the form data', async () => {
    const w = mountFreeze();
    await fill(w, 'FreezeFormData', { freezeType: 1 });
    expect(build(w)).toBeInstanceOf(FreezeTransaction);
  });

  test('loading a draft populates the form', async () => {
    const w = mountFreeze();
    await fill(w, 'FreezeFormData', {
      freezeType: 3,
      fileId: '0.0.150',
      fileHash: HASH,
      startTimestamp: new Date('2026-06-01T12:00:00Z'),
    });
    const draft = build(w) as FreezeTransaction;

    const w2 = mountFreeze();
    base(w2).vm.$emit('draft-loaded', draft);
    await flushPromises();
    const data = w2.findComponent({ name: 'FreezeFormData' }).props('data') as Record<
      string,
      unknown
    >;
    expect(data.freezeType).toBe(3);
    expect(data.fileId).toBe('0.0.150');
    expect(data.fileHash).toBe(HASH);
  });
});

describe.each([
  ['5.11.3 SystemDelete.vue', SystemDelete, 'SystemDeleteFormData', SystemDeleteTransaction, true],
  [
    '5.11.4 SystemUndelete.vue',
    SystemUndelete,
    'SystemUndeleteFormData',
    SystemUndeleteTransaction,
    false,
  ],
] as const)('%s', (_label, Comp, formName, TxClass, hasExpiration) => {
  const mountIt = () => mount(Comp);
  const exp = hasExpiration ? { expirationTime: new Date('2026-07-01T00:00:00Z') } : {};

  test('disabled when empty', () => {
    expect(disabled(mountIt())).toBe(true);
  });

  test('enabled with only a file id', async () => {
    const w = mountIt();
    await fill(w, formName, { fileId: '0.0.150', ...exp });
    expect(disabled(w)).toBe(false);
    expect(() => assertFn(w)()).not.toThrow();
  });

  test('enabled with only a contract id', async () => {
    const w = mountIt();
    await fill(w, formName, { contractId: '0.0.1234', ...exp });
    expect(disabled(w)).toBe(false);
    expect(() => assertFn(w)()).not.toThrow();
  });

  test('disabled when both file id and contract id are provided', async () => {
    const w = mountIt();
    await fill(w, formName, { fileId: '0.0.150', contractId: '0.0.1234', ...exp });
    expect(disabled(w)).toBe(true);
    expect(assertFn(w)).toThrow('either a File ID or a Contract ID');
  });

  test('disabled when file id is malformed', async () => {
    const w = mountIt();
    await fill(w, formName, { fileId: 'x', ...exp });
    expect(disabled(w)).toBe(true);
    expect(assertFn(w)).toThrow('Invalid File ID');
  });

  test('disabled when contract id is malformed', async () => {
    const w = mountIt();
    await fill(w, formName, { contractId: 'x', ...exp });
    expect(disabled(w)).toBe(true);
    expect(assertFn(w)).toThrow('Invalid Contract ID');
  });

  test('assert reports when neither id is given', () => {
    expect(assertFn(mountIt())).toThrow('File ID or Contract ID is required');
  });

  test('builds a file-targeted transaction', async () => {
    const w = mountIt();
    await fill(w, formName, { fileId: '0.0.150', ...exp });
    const tx = build(w) as SystemDeleteTransaction | SystemUndeleteTransaction;
    expect(tx).toBeInstanceOf(TxClass);
    expect(tx.fileId?.toString()).toBe('0.0.150');
    expect(tx.contractId).toBeFalsy();
  });

  test('builds a contract-targeted transaction', async () => {
    const w = mountIt();
    await fill(w, formName, { contractId: '0.0.1234', ...exp });
    const tx = build(w) as SystemDeleteTransaction | SystemUndeleteTransaction;
    expect(tx).toBeInstanceOf(TxClass);
    expect(tx.contractId?.toString()).toBe('0.0.1234');
    expect(tx.fileId).toBeFalsy();
  });

  test.each([
    ['file', { fileId: '0.0.150' }],
    ['contract', { contractId: '0.0.1234' }],
  ])('draft load populates the form from a %s-targeted draft', async (_t, target) => {
    const w = mountIt();
    await fill(w, formName, { ...target, ...exp });
    const draft = build(w);
    const w2 = mountIt();
    base(w2).vm.$emit('draft-loaded', draft);
    await flushPromises();
    const data = w2.findComponent({ name: formName }).props('data') as Record<string, unknown>;
    expect(data).toMatchObject(target);
  });
});

describe('5.11.3 SystemDelete.vue — expiration time', () => {
  test('disabled without an expiration time and assert reports it', async () => {
    const w = mount(SystemDelete);
    await fill(w, 'SystemDeleteFormData', { fileId: '0.0.150', expirationTime: null });
    expect(disabled(w)).toBe(true);
    expect(assertFn(w)).toThrow('Invalid Expiration Time');
  });
});

describe('5.12.4 NodeDelete.vue', () => {
  test('disabled until the node info has loaded', () => {
    expect(disabled(mount(NodeDelete))).toBe(true);
  });

  test('enabled once node info is available', async () => {
    const w = mount(NodeDelete);
    nodeInfo.value = { node_id: 3 };
    await flushPromises();
    expect(disabled(w)).toBe(false);
  });

  test('form update drives the node id lookup and the built transaction', async () => {
    const w = mount(NodeDelete);
    await fill(w, 'NodeDeleteFormData', { nodeId: '7' });
    expect(nodeId.value).toBe(7);
    const tx = build(w) as NodeDeleteTransaction;
    expect(tx).toBeInstanceOf(NodeDeleteTransaction);
    expect(tx.nodeId?.toString()).toBe('7');
  });

  test('draft load syncs node id lookup and form', async () => {
    const draft = new NodeDeleteTransaction().setNodeId(Long.fromNumber(9));
    const w = mount(NodeDelete);
    base(w).vm.$emit('draft-loaded', draft);
    await flushPromises();
    expect(nodeId.value).toBe(9);
    expect(w.findComponent({ name: 'NodeDeleteFormData' }).props('data')).toEqual({ nodeId: '9' });
  });

  test('success toast names the deleted node', async () => {
    const w = mount(NodeDelete);
    await fill(w, 'NodeDeleteFormData', { nodeId: '7' });
    base(w).vm.$emit('executed:success');
    await flushPromises();
    expect(mockToast.success).toHaveBeenCalledWith('Node 7 Deleted');
  });
});

describe('5.12.2 NodeCreate.vue', () => {
  const ep = { ipAddressV4: '10.0.0.1', domainName: '', port: '50211' };
  const valid = () => ({
    nodeAccountId: '0.0.5',
    gossipEndpoints: [ep],
    serviceEndpoints: [ep],
    gossipCaCertificate: Uint8Array.from([1, 2, 3]),
    adminKey: PrivateKey.generateED25519().publicKey,
  });

  test('disabled until an admin key is set', async () => {
    const w = mount(NodeCreate);
    expect(disabled(w)).toBe(true);
    await fill(w, 'NodeFormData', valid());
    expect(disabled(w)).toBe(false);
  });

  test.each([
    ['nodeAccountId', '', 'Node Account ID Required'],
    ['gossipEndpoints', [], 'Gossip Endpoints Required'],
    ['serviceEndpoints', [], 'Service Endpoints Required'],
    ['gossipCaCertificate', null, 'Gossip CA Certificate Required'],
    ['adminKey', null, 'Admin Key Required'],
  ])('preCreateAssert rejects missing %s', async (field, value, message) => {
    const w = mount(NodeCreate);
    await fill(w, 'NodeFormData', { ...valid(), [field]: value });
    expect(assertFn(w)).toThrow(message);
  });

  test('preCreateAssert passes with a complete form', async () => {
    const w = mount(NodeCreate);
    await fill(w, 'NodeFormData', valid());
    expect(assertFn(w)()).toBe(true);
  });

  test('builds a NodeCreateTransaction carrying the form data', async () => {
    const w = mount(NodeCreate);
    const data = valid();
    await fill(w, 'NodeFormData', data);
    const tx = build(w) as NodeCreateTransaction;
    expect(tx).toBeInstanceOf(NodeCreateTransaction);
    expect(tx.accountId?.toString()).toBe('0.0.5');
    expect(tx.gossipEndpoints).toHaveLength(1);
    expect(tx.serviceEndpoints).toHaveLength(1);
    expect(tx.adminKey?.toString()).toBe(data.adminKey.toString());
  });

  test('draft load populates the form', async () => {
    const w = mount(NodeCreate);
    await fill(w, 'NodeFormData', valid());
    const draft = build(w);
    const w2 = mount(NodeCreate);
    base(w2).vm.$emit('draft-loaded', draft);
    await flushPromises();
    const data = w2.findComponent({ name: 'NodeFormData' }).props('data') as Record<
      string,
      unknown
    >;
    expect(data.nodeAccountId).toBe('0.0.5');
    expect((data.gossipEndpoints as unknown[]).length).toBe(1);
  });
});
