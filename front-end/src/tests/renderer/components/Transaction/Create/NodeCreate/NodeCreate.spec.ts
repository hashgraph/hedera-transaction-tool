// @vitest-environment happy-dom
import { describe, test, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { PrivateKey } from '@hiero-ledger/sdk';

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({ personal: null }),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => ({ success: vi.fn(), error: vi.fn() }) },
}));

// x509BytesFromPem goes through Electron IPC (window.electronAPI), which
// doesn't exist in this test environment. Stub it so entering PEM text in the
// gossip CA certificate field actually produces bytes, the way a real upload
// would, so `createDisabled`'s certificate check can be satisfied.
vi.mock('@renderer/services/electronUtilsService', () => ({
  x509BytesFromPem: vi.fn().mockResolvedValue({
    raw: [1, 2, 3, 4],
    hash: 'public-key-hash',
    text: 'GOSSIP CERT PEM',
  }),
  sha384: vi.fn().mockResolvedValue('aa'.repeat(48)),
}));

// BaseTransaction is huge (payer data, stores, group handling) and irrelevant
// here — we only care what `createDisabled` it's fed as the form is filled in.
vi.mock('@renderer/components/Transaction/Create/BaseTransaction', () => ({
  default: {
    name: 'BaseTransaction',
    props: ['createTransaction', 'createDisabled', 'preCreateAssert'],
    emits: ['executed:success', 'draft-loaded'],
    template: '<div><slot /></div>',
    methods: { updateTransactionKey: vi.fn() },
  },
}));

const adminKey = PrivateKey.generateED25519().publicKey;

const stubs = {
  AppButton: {
    inheritAttrs: false,
    props: ['disabled'],
    template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
  },
  KeyField: {
    template: '<button data-testid="stub-admin-key" @click="$emit(\'update:model-key\', key)"></button>',
    props: ['modelKey', 'isRequired'],
    emits: ['update:model-key'],
    setup() {
      return { key: adminKey };
    },
  },
  RegisteredNodeIdInput: true,
};

import NodeCreate from '@renderer/components/Transaction/Create/NodeCreate/NodeCreate.vue';

async function mountNodeCreate() {
  const wrapper = mount(NodeCreate, { global: { stubs } });
  await flushPromises();
  return wrapper;
}

function readCreateDisabled(wrapper: Awaited<ReturnType<typeof mountNodeCreate>>) {
  return wrapper.findComponent({ name: 'BaseTransaction' }).props('createDisabled') as boolean;
}

describe('NodeCreate.vue — createDisabled', () => {
  test('is disabled with nothing entered', async () => {
    const wrapper = await mountNodeCreate();
    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  // createDisabled must gate on every field `preCreateAssert` requires (node
  // account id, both endpoint types, the gossip CA certificate, and the admin
  // key) — not just the admin key — so the button never lights up only to
  // reject the click with a toast error.
  test('stays disabled once the admin key is set while other required fields are still empty', async () => {
    const wrapper = await mountNodeCreate();

    await wrapper.find('[data-testid="stub-admin-key"]').trigger('click');

    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  test('is enabled once every required field is set', async () => {
    const wrapper = await mountNodeCreate();

    await wrapper.find('input[placeholder="Enter Node Account ID"]').setValue('0.0.5');

    await wrapper.find('[data-testid="input-gossip-ip-or-domain"]').setValue('10.0.0.1');
    await wrapper.find('[data-testid="input-gossip-port"]').setValue('50111');
    await wrapper.find('[data-testid="button-add-gossip-endpoint"]').trigger('click');

    await wrapper.find('[data-testid="input-service-ip-or-domain"]').setValue('10.0.0.2');
    await wrapper.find('[data-testid="input-service-port"]').setValue('50211');
    await wrapper.find('[data-testid="button-add-service-endpoint"]').trigger('click');

    await wrapper.find('textarea[placeholder="Enter Gossip CA Certificate"]').setValue('-----BEGIN CERT-----');
    await flushPromises();

    await wrapper.find('[data-testid="stub-admin-key"]').trigger('click');

    expect(readCreateDisabled(wrapper)).toBe(false);
  });

  // `gossipCaCertificate` starts as `Uint8Array.from([])`, which is truthy,
  // so a plain `!data.gossipCaCertificate` check never actually gates on it
  // being empty — this locks in the byte-length check instead.
  test('stays disabled while every other required field is set but the certificate is empty', async () => {
    const wrapper = await mountNodeCreate();

    await wrapper.find('input[placeholder="Enter Node Account ID"]').setValue('0.0.5');

    await wrapper.find('[data-testid="input-gossip-ip-or-domain"]').setValue('10.0.0.1');
    await wrapper.find('[data-testid="input-gossip-port"]').setValue('50111');
    await wrapper.find('[data-testid="button-add-gossip-endpoint"]').trigger('click');

    await wrapper.find('[data-testid="input-service-ip-or-domain"]').setValue('10.0.0.2');
    await wrapper.find('[data-testid="input-service-port"]').setValue('50211');
    await wrapper.find('[data-testid="button-add-service-endpoint"]').trigger('click');

    await wrapper.find('[data-testid="stub-admin-key"]').trigger('click');

    expect(readCreateDisabled(wrapper)).toBe(true);
  });
});
