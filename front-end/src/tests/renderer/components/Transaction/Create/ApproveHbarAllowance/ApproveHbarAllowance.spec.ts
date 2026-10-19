// @vitest-environment happy-dom
import { describe, test, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import { Key } from '@hiero-ledger/sdk';

// Module-level mock state the useAccountId mock closes over. The composable is called
// twice (owner, spender) — each call gets its own fresh instance pushed here in order,
// so a test can drive each account's `key` independently of real mirror-node lookups.
const instances: Array<{ accountId: { value: string }; key: { value: Key | null } }> = [];

vi.mock('@renderer/composables/useAccountId', () => ({
  default: () => {
    const instance = { accountId: ref(''), key: ref<Key | null>(null), accountInfo: ref(null), allowances: ref([]) };
    instances.push(instance);
    return instance;
  },
}));

// BaseTransaction is huge (payer data, stores, group handling) and irrelevant here —
// we only care what `createDisabled` it's fed as the form is filled in.
vi.mock('@renderer/components/Transaction/Create/BaseTransaction', () => ({
  default: {
    name: 'BaseTransaction',
    props: ['createTransaction', 'createDisabled', 'preCreateAssert'],
    template: '<div><slot /></div>',
    setup(_props: unknown, { expose }: { expose: (exposed: object) => void }) {
      expose({ updateTransactionKey: () => {} });
    },
  },
}));

import ApproveHbarAllowance from '@renderer/components/Transaction/Create/ApproveHbarAllowance/ApproveHbarAllowance.vue';

function mountApproveHbarAllowance() {
  instances.length = 0;
  return mount(ApproveHbarAllowance);
}

function readCreateDisabled(wrapper: ReturnType<typeof mountApproveHbarAllowance>) {
  return wrapper.findComponent({ name: 'BaseTransaction' }).props('createDisabled') as boolean;
}

describe('ApproveHbarAllowance.vue — both an owner and a spender key are required', () => {
  test('is disabled with nothing entered', () => {
    const wrapper = mountApproveHbarAllowance();
    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  test('is disabled with only the owner key resolved', async () => {
    const wrapper = mountApproveHbarAllowance();
    const [ownerData] = instances;

    ownerData.key.value = {} as Key;
    await nextTick();

    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  test('is enabled once both the owner and spender keys are resolved', async () => {
    const wrapper = mountApproveHbarAllowance();
    const [ownerData, spenderData] = instances;

    ownerData.key.value = {} as Key;
    spenderData.key.value = {} as Key;
    await nextTick();

    expect(readCreateDisabled(wrapper)).toBe(false);
  });
});
