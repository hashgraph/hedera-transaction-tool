// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { GeneralServiceEndpoint, PrivateKey } from '@hiero-ledger/sdk';

// Forces `@renderer/utils`'s barrel to fully resolve before anything below
// reaches it from the `@renderer/utils/sdk/createTransactions` side (which
// RegisteredNodeUpdate.vue imports first internally) — that barrel and
// `@renderer/utils/sdk`'s barrel import each other, and entering the cycle
// from the deep sdk-file side first leaves other barrel exports (like
// `utf8ByteLength`, used by the real RegisteredNodeFormData child) permanently
// unresolved for the rest of the module graph.
import '@renderer/utils';

import type { IRegisteredNodeInfoParsed } from '@shared/interfaces';

// Module-level mock state closed over by the `vi.mock` factory below.
const refs = {
  registeredNodeId: ref<number | null>(null),
  registeredNodeInfo: ref<IRegisteredNodeInfoParsed | null>(null),
};
let mockRouteQuery: Record<string, string | undefined> = {};

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mockRouteQuery }),
}));

vi.mock('@renderer/composables/useRegisteredNodeId', () => ({
  default: () => ({
    registeredNodeId: refs.registeredNodeId,
    registeredNodeInfo: refs.registeredNodeInfo,
    key: ref(null),
    isValid: ref(false),
    accountData: { accountId: ref('') },
  }),
}));

// BaseTransaction is huge (payer data, stores, group handling) and irrelevant
// here — we only care what `createDisabled` it's fed as the form is filled in.
vi.mock('@renderer/components/Transaction/Create/BaseTransaction', () => ({
  default: {
    name: 'BaseTransaction',
    props: ['createTransaction', 'createDisabled', 'preCreateAssert'],
    emits: ['executed:success', 'draft-loaded'],
    methods: { updateTransactionKey() {} },
    template: '<div><slot /></div>',
  },
}));

const adminKey = PrivateKey.generateED25519().publicKey;

// KeyField pulls in a Pinia store unrelated to the disabled-state behavior
// under test here, so it's replaced with a stub that emits a fixed test key.
const stubs = {
  KeyField: {
    props: ['modelKey', 'label', 'isRequired'],
    emits: ['update:modelKey'],
    data: () => ({ adminKey }),
    template:
      '<div>' +
      '<button data-testid="stub-admin-key" @click="$emit(\'update:modelKey\', adminKey)" />' +
      '<button data-testid="stub-admin-key-clear" @click="$emit(\'update:modelKey\', null)" />' +
      '</div>',
  },
};

import RegisteredNodeUpdate from '@renderer/components/Transaction/Create/RegisteredNodeUpdate/RegisteredNodeUpdate.vue';

function mountRegisteredNodeUpdate() {
  return mount(RegisteredNodeUpdate, { global: { stubs } });
}

function readCreateDisabled(wrapper: ReturnType<typeof mountRegisteredNodeUpdate>) {
  return wrapper.findComponent({ name: 'BaseTransaction' }).props('createDisabled') as boolean;
}

const resolvedNode = (overrides: Partial<IRegisteredNodeInfoParsed> = {}) =>
  ({
    description: '',
    admin_key: null,
    service_endpoints: [],
    ...overrides,
  }) as unknown as IRegisteredNodeInfoParsed;

// Only the registered node id is required by the protocol — admin key, description and
// endpoints are all optional — so the button needs a resolved node and at least one change.
describe('RegisteredNodeUpdate.vue — a resolved registered node and at least one change are required', () => {
  beforeEach(() => {
    mockRouteQuery = {};
    refs.registeredNodeId.value = null;
    refs.registeredNodeInfo.value = null;
  });

  async function mountResolved(info: IRegisteredNodeInfoParsed) {
    const wrapper = mountRegisteredNodeUpdate();
    refs.registeredNodeInfo.value = info;
    await wrapper.vm.$nextTick();
    return wrapper;
  }

  test('is disabled when the registered node id has not resolved', () => {
    const wrapper = mountRegisteredNodeUpdate();
    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  test('is disabled when nothing differs from the resolved node', async () => {
    const wrapper = await mountResolved(resolvedNode());
    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  test('is disabled when the pre-filled admin key is left unchanged', async () => {
    const wrapper = await mountResolved(resolvedNode({ admin_key: adminKey }));
    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  test('is enabled by changing only the description', async () => {
    const wrapper = await mountResolved(resolvedNode());

    await wrapper.find('input[placeholder="Enter Description"]').setValue('new description');

    expect(readCreateDisabled(wrapper)).toBe(false);
  });

  test('is enabled by changing only the admin key', async () => {
    const wrapper = await mountResolved(resolvedNode());

    await wrapper.find('[data-testid="stub-admin-key"]').trigger('click');

    expect(readCreateDisabled(wrapper)).toBe(false);
  });

  test('is enabled by adding only a service endpoint', async () => {
    const wrapper = await mountResolved(resolvedNode());

    await wrapper.find('[data-testid="input-registered-endpoint-address"]').setValue('10.0.0.1');
    await wrapper.find('[data-testid="input-registered-endpoint-port"]').setValue('443');
    await wrapper.find('[data-testid="button-add-registered-endpoint"]').trigger('click');

    expect(readCreateDisabled(wrapper)).toBe(false);
  });

  test('is disabled again when a change is reverted', async () => {
    const wrapper = await mountResolved(resolvedNode());
    const description = wrapper.find('input[placeholder="Enter Description"]');

    await description.setValue('new description');
    await description.setValue('');

    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  // `RegisteredNodeUpdateTransaction.setAdminKey` rejects `null`, so the SDK
  // can't represent "remove the admin key". Clearing a previously-set admin
  // key must stay disabled rather than submit an update that silently leaves
  // it untouched.
  test('stays disabled when a previously-set admin key is cleared', async () => {
    const wrapper = await mountResolved(resolvedNode({ admin_key: adminKey }));

    await wrapper.find('[data-testid="stub-admin-key-clear"]').trigger('click');

    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  // An empty `serviceEndpoint` replacement list is rejected by the consensus
  // node (HIP-1137 requires at least one), so removing the last existing
  // endpoint must stay disabled rather than submit an update that can't
  // apply the removal.
  test('stays disabled when the last existing service endpoint is removed', async () => {
    const endpoint = new GeneralServiceEndpoint()
      .setIpAddress(new Uint8Array([10, 0, 0, 1]))
      .setPort(443)
      .setRequiresTls(true);
    const wrapper = await mountResolved(resolvedNode({ service_endpoints: [endpoint] }));

    await wrapper.find('[data-testid="button-delete-registered-endpoint-0"]').trigger('click');

    expect(readCreateDisabled(wrapper)).toBe(true);
  });
});
