// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';
import { mount } from '@vue/test-utils';

// RegisteredNodeFormData.vue must be imported before any value (non-type)
// import from `@renderer/utils/sdk` below — mounting it first registers the
// `@hiero-ledger/sdk` module the way the real app does, avoiding a partial
// mock from a differently-ordered import elsewhere in the suite.
import RegisteredNodeFormData from '@renderer/components/Transaction/Create/RegisteredNodeCreate/RegisteredNodeFormData.vue';

import { BlockNodeServiceEndpoint, Hbar, PrivateKey, RegisteredNodeCreateTransaction } from '@hiero-ledger/sdk';

import type { RegisteredNodeData } from '@renderer/utils/sdk';

import { createRegisteredNodeCreateTransaction } from '@renderer/utils/sdk/createTransactions';

const adminKey = PrivateKey.generateED25519().publicKey;

// KeyField needs a Pinia store unrelated to the behavior under test here, and
// its own key-entry mechanics are covered elsewhere, so it's replaced with a
// stub that emits a fixed test key on interaction.
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

function makeData(overrides: Partial<RegisteredNodeData> = {}): RegisteredNodeData {
  return {
    description: '',
    adminKey: null,
    serviceEndpoints: [],
    ...overrides,
  };
}

function mountForm(data: RegisteredNodeData = makeData()) {
  return mount(RegisteredNodeFormData, { props: { data }, global: { stubs } });
}

async function applyLastEmit(wrapper: ReturnType<typeof mountForm>) {
  const events = wrapper.emitted('update:data');
  const last = events?.[events.length - 1]?.[0] as RegisteredNodeData;
  await wrapper.setProps({ data: last });
  return last;
}

describe('RegisteredNodeFormData.vue — required fields only produce a valid transaction', () => {
  test('admin key + one endpoint builds a RegisteredNodeCreateTransaction carrying both', async () => {
    const wrapper = mountForm();

    await wrapper.find('[data-testid="stub-admin-key"]').trigger('click');
    await applyLastEmit(wrapper);

    await wrapper.find('[data-testid="input-registered-endpoint-address"]').setValue('10.0.0.1');
    await wrapper.find('[data-testid="input-registered-endpoint-port"]').setValue('443');
    await wrapper.find('[data-testid="button-add-registered-endpoint"]').trigger('click');
    const data = await applyLastEmit(wrapper);

    const tx = createRegisteredNodeCreateTransaction({ ...common, ...data });
    expect(tx).toBeInstanceOf(RegisteredNodeCreateTransaction);
    expect(tx.adminKey?.toString()).toBe(adminKey.toString());
    expect(tx.serviceEndpoints).toHaveLength(1);
    expect(tx.serviceEndpoints[0]).toBeInstanceOf(BlockNodeServiceEndpoint);
  });
});

describe('RegisteredNodeFormData.vue — every field entered maps onto the transaction', () => {
  test('description, admin key and endpoint all land on the transaction', async () => {
    const wrapper = mountForm();

    await wrapper.find('[data-testid="input-registered-description"]').setValue('my registered node');
    let data = await applyLastEmit(wrapper);

    await wrapper.find('[data-testid="stub-admin-key"]').trigger('click');
    data = await applyLastEmit(wrapper);

    await wrapper.find('[data-testid="input-registered-endpoint-address"]').setValue('10.0.0.1');
    await wrapper.find('[data-testid="input-registered-endpoint-port"]').setValue('443');
    await wrapper.find('[data-testid="switch-registered-endpoint-tls"]').trigger('input');
    await wrapper.find('[data-testid="button-add-registered-endpoint"]').trigger('click');
    data = await applyLastEmit(wrapper);

    const tx = createRegisteredNodeCreateTransaction({ ...common, ...data });
    expect(tx.description).toBe('my registered node');
    expect(tx.adminKey?.toString()).toBe(adminKey.toString());
    expect(tx.serviceEndpoints).toHaveLength(1);
    expect(tx.serviceEndpoints[0].domainName).toBeNull();
  });

  test('deleting an endpoint through the table is reflected on the transaction', async () => {
    const wrapper = mountForm(
      makeData({
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

    // createRegisteredNodeCreateTransaction only calls setServiceEndpoints
    // when the list is non-empty, so an emptied list leaves the transaction's
    // default (`[]`) untouched rather than explicitly setting one. This is
    // never reachable from the real UI — RegisteredNodeCreate.vue's
    // createDisabled requires at least one service endpoint before Create is
    // enabled — but it's worth pinning down at the function level.
    const tx = createRegisteredNodeCreateTransaction({ ...common, ...data });
    expect(tx.serviceEndpoints).toEqual([]);
  });
});
