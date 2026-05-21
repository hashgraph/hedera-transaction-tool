// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { AccountId } from '@hiero-ledger/sdk';

import type { INodeInfoParsed } from '@shared/interfaces';

// Module-level mock state. `vi.mock` factories below close over these and
// only deref them when the consuming code (NodeUpdate's setup) actually
// invokes the mocked function — by which point these are initialized.
const refs = {
  nodeInfo: ref<INodeInfoParsed | null>(null),
  nodeId: ref<number | null>(null),
  newAccountId: ref<string>(''),
};
const mockToast = { success: vi.fn(), error: vi.fn() };
let mockRouteQuery: Record<string, string | undefined> = {};

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mockRouteQuery }),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => mockToast },
}));

vi.mock('@renderer/composables/useNodeId', () => ({
  default: () => ({
    nodeInfo: refs.nodeInfo,
    nodeId: refs.nodeId,
    accountData: { accountId: refs.newAccountId },
  }),
}));

vi.mock('@renderer/composables/useAccountId', () => ({
  default: () => ({ accountId: refs.newAccountId }),
}));

// Keep `@renderer/utils` mostly real (we need `getNodeUpdateData` from it for
// draft-load handlers we don't exercise), but stub `getComponentServiceEndpoint`
// so the watcher's grpc-proxy line doesn't try to reach into endpoint utils.
vi.mock('@renderer/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@renderer/utils')>();
  return {
    ...actual,
    getComponentServiceEndpoint: () => null,
  };
});

// Stub the heavy children inline. We read NodeUpdateFormData's :data prop
// later via `findComponent({ name: 'NodeUpdateFormData' })` to see what
// NodeUpdate.vue's watcher seeded after a nodeInfo change. The stubs must
// be inlined inside the mock factories because `vi.mock` is hoisted above
// any module-level `const` declarations.
vi.mock('@renderer/components/Transaction/Create/BaseTransaction', () => ({
  default: {
    name: 'BaseTransaction',
    props: ['createTransaction', 'createDisabled'],
    emits: ['executed:success', 'draft-loaded'],
    // NodeUpdate.vue has a second watcher that calls
    // `baseTransactionRef.value?.updateTransactionKey()`. Exposing a no-op
    // here prevents that watcher from throwing into the unhandled-rejection
    // channel and (in some test orderings) tripping up the assertion.
    methods: { updateTransactionKey() {} },
    template: '<div><slot /></div>',
  },
}));

vi.mock(
  '@renderer/components/Transaction/Create/NodeUpdate/NodeUpdateFormData.vue',
  () => ({
    default: {
      name: 'NodeUpdateFormData',
      props: ['data'],
      emits: ['update:data'],
      template: '<div data-testid="form-stub"></div>',
    },
  }),
);

import NodeUpdate from '@renderer/components/Transaction/Create/NodeUpdate/NodeUpdate.vue';

function makeNodeInfo(overrides: Partial<INodeInfoParsed> = {}): INodeInfoParsed {
  return {
    admin_key: null,
    description: 'node-3',
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
    associated_registered_node: [],
    ...overrides,
  };
}

async function mountAndSettle() {
  const wrapper = mount(NodeUpdate);
  await flushPromises();
  return wrapper;
}

function readSeededData(wrapper: ReturnType<typeof mount>) {
  return wrapper.findComponent({ name: 'NodeUpdateFormData' }).props('data') as {
    associatedRegisteredNodes: string[];
    nodeAccountId: string;
    description: string;
  };
}

describe('NodeUpdate.vue — associatedRegisteredNodes seeding watcher', () => {
  beforeEach(() => {
    mockRouteQuery = {};
    refs.nodeInfo.value = null;
    refs.nodeId.value = null;
    refs.newAccountId.value = '';
    vi.clearAllMocks();
  });

  test('seeds data.associatedRegisteredNodes from nodeInfo when it loads', async () => {
    const wrapper = await mountAndSettle();

    refs.nodeInfo.value = makeNodeInfo({ associated_registered_node: [1, 7, 12] });
    await flushPromises();

    expect(readSeededData(wrapper).associatedRegisteredNodes).toEqual(['1', '7', '12']);
  });

  test('seeds data.associatedRegisteredNodes to [] when nodeInfo carries an empty list', async () => {
    const wrapper = await mountAndSettle();

    refs.nodeInfo.value = makeNodeInfo({ associated_registered_node: [] });
    await flushPromises();

    expect(readSeededData(wrapper).associatedRegisteredNodes).toEqual([]);
  });

  test('resets data.associatedRegisteredNodes to [] when nodeInfo clears', async () => {
    const wrapper = await mountAndSettle();

    refs.nodeInfo.value = makeNodeInfo({ associated_registered_node: [1, 2] });
    await flushPromises();
    expect(readSeededData(wrapper).associatedRegisteredNodes).toEqual(['1', '2']);

    refs.nodeInfo.value = null;
    await flushPromises();
    expect(readSeededData(wrapper).associatedRegisteredNodes).toEqual([]);
  });

  test('skips seeding when a draftId is present in the route (draft load owns the data)', async () => {
    // When loading a draft, NodeUpdate's watcher skips the "seed from nodeInfo"
    // branch so the draft's data isn't clobbered. The associatedRegisteredNodes
    // field must honor this too.
    mockRouteQuery = { draftId: 'abc' };
    const wrapper = await mountAndSettle();

    refs.nodeInfo.value = makeNodeInfo({ associated_registered_node: [9, 10] });
    await flushPromises();

    // Untouched — stays at the initial empty state from the reactive declaration.
    expect(readSeededData(wrapper).associatedRegisteredNodes).toEqual([]);
  });
});
