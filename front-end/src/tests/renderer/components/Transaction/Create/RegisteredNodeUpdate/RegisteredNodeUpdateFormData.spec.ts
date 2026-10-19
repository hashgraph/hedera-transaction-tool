// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';
import { mount } from '@vue/test-utils';

// RegisteredNodeUpdateFormData.vue must be imported before any value (non-type)
// import from `@renderer/utils/sdk` below — see the note in
// RegisteredNodeFormData.spec.ts for why the import order matters.
import RegisteredNodeUpdateFormData from '@renderer/components/Transaction/Create/RegisteredNodeUpdate/RegisteredNodeUpdateFormData.vue';

import { BlockNodeServiceEndpoint, Hbar, PrivateKey, RegisteredNodeUpdateTransaction } from '@hiero-ledger/sdk';

import type { RegisteredNodeUpdateData } from '@renderer/utils/sdk';

import { createRegisteredNodeUpdateTransaction } from '@renderer/utils/sdk/createTransactions';

const adminKey = PrivateKey.generateED25519().publicKey;

// KeyField (pulled in transitively via RegisteredNodeFormData) needs a Pinia
// store unrelated to the behavior under test here, and its own key-entry
// mechanics are covered elsewhere, so it's replaced with a stub that emits a
// fixed test key on interaction.
const stubs = {
  KeyField: {
    props: ['modelKey', 'label', 'isRequired'],
    emits: ['update:modelKey'],
    data: () => ({ adminKey }),
    template: '<button data-testid="stub-admin-key" @click="$emit(\'update:modelKey\', adminKey)" />',
  },
};

const common = {
  payerId: '0.0.2',
  validStart: new Date(Date.now() + 60_000),
  maxTransactionFee: new Hbar(2),
  transactionMemo: '',
};

function makeData(overrides: Partial<RegisteredNodeUpdateData> = {}): RegisteredNodeUpdateData {
  return {
    registeredNodeId: '3',
    description: '',
    adminKey: null,
    serviceEndpoints: [],
    ...overrides,
  };
}

function mountForm(data: RegisteredNodeUpdateData = makeData()) {
  return mount(RegisteredNodeUpdateFormData, { props: { data }, global: { stubs } });
}

async function applyLastEmit(wrapper: ReturnType<typeof mountForm>) {
  const events = wrapper.emitted('update:data');
  const last = events?.[events.length - 1]?.[0] as RegisteredNodeUpdateData;
  await wrapper.setProps({ data: last });
  return last;
}

describe('RegisteredNodeUpdateFormData.vue — required fields only produce a valid transaction', () => {
  test('registered node id + admin key + one endpoint builds a RegisteredNodeUpdateTransaction carrying all three', async () => {
    const wrapper = mountForm(makeData({ registeredNodeId: '9' }));

    await wrapper.find('[data-testid="stub-admin-key"]').trigger('click');
    await applyLastEmit(wrapper);

    await wrapper.find('[data-testid="input-registered-endpoint-address"]').setValue('10.0.0.1');
    await wrapper.find('[data-testid="input-registered-endpoint-port"]').setValue('443');
    await wrapper.find('[data-testid="button-add-registered-endpoint"]').trigger('click');
    const data = await applyLastEmit(wrapper);

    const tx = createRegisteredNodeUpdateTransaction({ ...common, ...data });
    expect(tx).toBeInstanceOf(RegisteredNodeUpdateTransaction);
    expect(tx.registeredNodeId?.toString()).toBe('9');
    expect(tx.adminKey?.toString()).toBe(adminKey.toString());
    expect(tx.serviceEndpoints).toHaveLength(1);
    expect(tx.serviceEndpoints![0]).toBeInstanceOf(BlockNodeServiceEndpoint);
  });
});

describe('RegisteredNodeUpdateFormData.vue — every field entered maps onto the transaction', () => {
  test('changing the id, description and endpoints through the composed form all land on the transaction', async () => {
    const wrapper = mountForm(makeData({ registeredNodeId: '9', description: 'existing' }));

    await wrapper.find('[data-testid="input-registered-node-id"]').setValue('11');
    let data = await applyLastEmit(wrapper);
    expect(data.description).toBe('existing');

    await wrapper.find('[data-testid="stub-admin-key"]').trigger('click');
    data = await applyLastEmit(wrapper);

    await wrapper.find('[data-testid="input-registered-endpoint-address"]').setValue('10.0.0.1');
    await wrapper.find('[data-testid="input-registered-endpoint-port"]').setValue('443');
    await wrapper.find('[data-testid="button-add-registered-endpoint"]').trigger('click');
    data = await applyLastEmit(wrapper);

    const tx = createRegisteredNodeUpdateTransaction({ ...common, ...data });
    expect(tx.registeredNodeId?.toString()).toBe('11');
    expect(tx.description).toBe('existing');
    expect(tx.adminKey?.toString()).toBe(adminKey.toString());
    expect(tx.serviceEndpoints).toHaveLength(1);
  });

  test('deleting an endpoint through the composed table is reflected on the transaction', async () => {
    const wrapper = mountForm(
      makeData({
        registeredNodeId: '9',
        adminKey,
        serviceEndpoints: [
          {
            type: 'blockNode',
            ipAddressV4: '10.0.0.1',
            domainName: null,
            port: '443',
            requiresTls: false,
          },
        ],
      }),
    );

    await wrapper.find('[data-testid="button-delete-registered-endpoint-0"]').trigger('click');
    const data = await applyLastEmit(wrapper);
    expect(data.serviceEndpoints).toEqual([]);

    // createRegisteredNodeUpdateTransaction only calls setServiceEndpoints
    // when the list is non-empty, so an emptied list builds a transaction
    // with `null` (unset), not `[]`. This is never reachable from the real
    // UI — RegisteredNodeUpdate.vue's createDisabled requires at least one
    // service endpoint before Create is enabled — but it's worth pinning
    // down at the function level since the SDK itself has no trouble
    // representing an explicit empty list (setServiceEndpoints([])).
    const tx = createRegisteredNodeUpdateTransaction({ ...common, ...data });
    expect(tx.serviceEndpoints).toBeNull();
  });
});
