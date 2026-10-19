// @vitest-environment happy-dom
import { describe, test, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { Hbar, NodeCreateTransaction, PrivateKey } from '@hiero-ledger/sdk';

import type { NodeData } from '@renderer/utils/sdk';

import { createNodeCreateTransaction, type TransactionCommonData } from '@renderer/utils/sdk/createTransactions';
import { getNodeData } from '@renderer/utils/sdk/getData';

import NodeFormData from '@renderer/components/Transaction/Create/NodeCreate/NodeFormData.vue';

const adminKey = PrivateKey.generateED25519().publicKey;

// x509BytesFromPem/sha384 go through Electron IPC (window.electronAPI), which
// doesn't exist in this test environment. Stub them so entering PEM text in
// the certificate fields actually produces bytes, the way a real upload would.
vi.mock('@renderer/services/electronUtilsService', () => ({
  x509BytesFromPem: vi.fn().mockResolvedValue({
    raw: [1, 2, 3, 4],
    hash: 'public-key-hash',
    text: 'GOSSIP CERT PEM',
  }),
  sha384: vi.fn().mockResolvedValue('aa'.repeat(48)),
}));

// KeyField pulls in Pinia stores / network services unrelated to this form's
// own field-wiring. Stubbed with a button so the admin key (a required field)
// can still be set through a real user interaction.
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

const common: TransactionCommonData = {
  payerId: '0.0.2',
  validStart: new Date(Date.now() + 60_000),
  maxTransactionFee: new Hbar(2),
  transactionMemo: '',
};

function makeNodeData(overrides: Partial<NodeData> = {}): NodeData {
  return {
    nodeAccountId: '',
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

function mountForm(data: NodeData = makeNodeData()) {
  return mount(NodeFormData, { props: { data }, global: { stubs } });
}

// Simulates what the parent (NodeCreate.vue) does on `update:data`: re-render
// the form with the new data so later interactions see the merged state.
async function applyLastEmit(wrapper: ReturnType<typeof mountForm>) {
  const events = wrapper.emitted('update:data');
  const last = events?.[events.length - 1]?.[0] as NodeData;
  await wrapper.setProps({ data: last });
  return last;
}

// Mirrors NodeCreate.vue's `preCreateAssert`: node account id, at least one
// gossip and one service endpoint, a gossip CA certificate, and an admin key.
async function enterRequiredFields(wrapper: ReturnType<typeof mountForm>) {
  await wrapper.find('input[placeholder="Enter Node Account ID"]').setValue('0.0.5');
  await applyLastEmit(wrapper);

  await wrapper.find('[data-testid="input-gossip-ip-or-domain"]').setValue('10.0.0.1');
  await wrapper.find('[data-testid="input-gossip-port"]').setValue('50111');
  await wrapper.find('[data-testid="button-add-gossip-endpoint"]').trigger('click');
  await applyLastEmit(wrapper);

  await wrapper.find('[data-testid="input-service-ip-or-domain"]').setValue('10.0.0.2');
  await wrapper.find('[data-testid="input-service-port"]').setValue('50211');
  await wrapper.find('[data-testid="button-add-service-endpoint"]').trigger('click');
  await applyLastEmit(wrapper);

  await wrapper.find('textarea[placeholder="Enter Gossip CA Certificate"]').setValue('-----BEGIN CERT-----');
  await flushPromises();
  await applyLastEmit(wrapper);

  await wrapper.find('[data-testid="stub-admin-key"]').trigger('click');
  return applyLastEmit(wrapper);
}

describe('NodeFormData.vue — required fields produce a valid NodeCreate transaction', () => {
  test('entering only the required fields is enough to build a transaction carrying them', async () => {
    const wrapper = mountForm();

    const data = await enterRequiredFields(wrapper);
    const tx = createNodeCreateTransaction({ ...common, ...data });
    expect(tx).toBeInstanceOf(NodeCreateTransaction);

    const parsed = getNodeData(tx);
    expect(parsed.nodeAccountId).toBe('0.0.5');
    expect(parsed.gossipEndpoints).toEqual([{ ipAddressV4: '10.0.0.1', domainName: '', port: '50111' }]);
    expect(parsed.serviceEndpoints).toEqual([{ ipAddressV4: '10.0.0.2', domainName: '', port: '50211' }]);
    expect(Array.from(parsed.gossipCaCertificate)).toEqual([1, 2, 3, 4]);
    expect(parsed.adminKey?.toString()).toBe(adminKey.toString());
  });
});

describe('NodeFormData.vue — every field is mapped onto the NodeCreate transaction', () => {
  test('optional fields entered alongside the required ones all land on the transaction', async () => {
    const wrapper = mountForm();

    await enterRequiredFields(wrapper);

    await wrapper.find('input[placeholder="Enter Node Description"]').setValue('my node');
    let data = await applyLastEmit(wrapper);

    await wrapper.find('[data-testid="switch-accept-reward"]').trigger('input');
    data = await applyLastEmit(wrapper);

    const grpcDomain = wrapper.find('input[placeholder="Enter FQDN"]');
    await grpcDomain.setValue('proxy.example.com');
    await grpcDomain.trigger('blur');
    data = await applyLastEmit(wrapper);

    const tx = createNodeCreateTransaction({ ...common, ...data });
    const parsed = getNodeData(tx);

    expect(parsed.description).toBe('my node');
    expect(parsed.declineReward).toBe(true);
    expect(parsed.grpcWebProxyEndpoint).toEqual({
      ipAddressV4: '',
      domainName: 'proxy.example.com',
      port: '',
    });
    // Required fields are still intact alongside the optional ones.
    expect(parsed.nodeAccountId).toBe('0.0.5');
    expect(parsed.gossipEndpoints).toHaveLength(1);
    expect(parsed.serviceEndpoints).toHaveLength(1);
    expect(parsed.adminKey?.toString()).toBe(adminKey.toString());
  });
});
