// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { PrivateKey, type Key } from '@hiero-ledger/sdk';

import type { AccountUpdateData, AccountUpdateDataMultiple } from '@renderer/utils/sdk';

// Module-level mock state, closed over by the `vi.mock` factories below.
const refs = {
  firstAccountId: ref<string>(''),
  firstAccountKey: ref<Key | null>(null),
};

vi.mock('@renderer/composables/useAccountId', () => ({
  default: () => ({
    accountId: refs.firstAccountId,
    accountInfo: ref(null),
    key: refs.firstAccountKey,
    isValid: ref(false),
  }),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: () => ({ client: {} }),
}));

// Keep the rest of `@renderer/utils` real, but replace `splitMultipleAccounts`
// with a trivial comma-split so tests don't need a real Hedera Client to
// compute checksums.
vi.mock('@renderer/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@renderer/utils')>();
  return {
    ...actual,
    splitMultipleAccounts: (input: string) =>
      input
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
  };
});

import AccountUpdateFormData from '@renderer/components/Transaction/Create/AccountUpdate/AccountUpdateFormData.vue';

const key1 = PrivateKey.generateED25519().publicKey;
const key2 = PrivateKey.generateED25519().publicKey;
const key3 = PrivateKey.generateED25519().publicKey;

const AccountDataFormDataStub = {
  name: 'AccountDataFormData',
  props: ['data', 'multipleAccountsData'],
  emits: ['update:data', 'update:multiple-accounts-data'],
  template: '<div data-testid="account-data-form-stub"></div>',
};

const AppCheckBoxStub = {
  name: 'AppCheckBox',
  props: ['checked', 'label', 'name'],
  emits: ['update:checked'],
  template: '<div />',
};

const AppInputStub = {
  name: 'AppInput',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input />',
};

const globalStubs = {
  AccountDataFormData: AccountDataFormDataStub,
  AppCheckBox: AppCheckBoxStub,
  AppButton: { template: '<button><slot /></button>' },
  AppInput: AppInputStub,
  AccountIdInput: { template: '<input />' },
  KeyStructureModal: { template: '<div />' },
};

function baseData(overrides: Partial<AccountUpdateData> = {}): AccountUpdateData {
  return {
    accountId: '',
    receiverSignatureRequired: false,
    maxAutomaticTokenAssociations: 0,
    stakeType: 'None',
    stakedAccountId: '',
    stakedNodeId: null,
    declineStakingReward: false,
    accountMemo: '',
    ownerKey: null,
    ...overrides,
  };
}

function mountField(
  props: Partial<{
    data: AccountUpdateData;
    accountInfo: null;
    multipleAccountsData: AccountUpdateDataMultiple | null;
  }> = {},
) {
  return mount(AccountUpdateFormData, {
    props: {
      data: baseData(),
      accountInfo: null,
      multipleAccountsData: null,
      ...props,
    },
    global: { stubs: globalStubs },
  });
}

function lastMultipleAccountsEmit(wrapper: ReturnType<typeof mount>) {
  const emitted = wrapper.emitted('update:multipleAccountsData');
  return emitted?.at(-1)?.[0] as AccountUpdateDataMultiple | null | undefined;
}

async function enableMultipleAccounts(wrapper: ReturnType<typeof mount>) {
  const checkbox = wrapper
    .findAllComponents(AppCheckBoxStub)
    .find(c => c.props('name') === 'multiple-accounts')!;
  checkbox.vm.$emit('update:checked', true);
  await flushPromises();
}

describe('AccountUpdateFormData.vue — multi-account key guard (explicitKey vs. mirror default)', () => {
  beforeEach(() => {
    refs.firstAccountId.value = '';
    refs.firstAccountKey.value = null;
    vi.clearAllMocks();
  });

  test('derives the multi-account key from the first account lookup by default', async () => {
    const wrapper = mountField();
    await enableMultipleAccounts(wrapper);

    refs.firstAccountKey.value = key1;
    await flushPromises();

    expect(lastMultipleAccountsEmit(wrapper)?.key).toStrictEqual(key1);
  });

  test('keeps the explicitly selected key when the first account key changes again', async () => {
    const wrapper = mountField();
    await enableMultipleAccounts(wrapper);

    refs.firstAccountKey.value = key1;
    await flushPromises();
    expect(lastMultipleAccountsEmit(wrapper)?.key).toStrictEqual(key1);

    // User explicitly picks a different key via AccountDataFormData's KeyField.
    const accountDataForm = wrapper.findComponent(AccountDataFormDataStub);
    accountDataForm.vm.$emit('update:multiple-accounts-data', {
      accountIds: [],
      accountIsPayer: false,
      key: key2,
    });
    await flushPromises();
    expect(lastMultipleAccountsEmit(wrapper)?.key).toStrictEqual(key2);

    // The first account changes again (e.g. a new mirror-node lookup) and
    // reports a brand-new default key — the explicit choice must survive.
    refs.firstAccountKey.value = key3;
    await flushPromises();

    expect(lastMultipleAccountsEmit(wrapper)?.key).toStrictEqual(key2);
  });

  test('resets the explicit key and re-derives from the first account when multiple-accounts mode is toggled off and back on', async () => {
    const wrapper = mountField();
    await enableMultipleAccounts(wrapper);

    refs.firstAccountKey.value = key1;
    await flushPromises();

    const accountDataForm = wrapper.findComponent(AccountDataFormDataStub);
    accountDataForm.vm.$emit('update:multiple-accounts-data', {
      accountIds: [],
      accountIsPayer: false,
      key: key2,
    });
    await flushPromises();
    expect(lastMultipleAccountsEmit(wrapper)?.key).toStrictEqual(key2);

    // Toggle off, then back on.
    const checkbox = wrapper
      .findAllComponents(AppCheckBoxStub)
      .find(c => c.props('name') === 'multiple-accounts')!;
    checkbox.vm.$emit('update:checked', false);
    await flushPromises();
    expect(lastMultipleAccountsEmit(wrapper)).toBeNull();

    checkbox.vm.$emit('update:checked', true);
    await flushPromises();

    // The explicit choice from the previous session should not resurface —
    // the field falls back to whatever the first account currently reports.
    expect(lastMultipleAccountsEmit(wrapper)?.key).toStrictEqual(key1);
  });
});

describe('AccountUpdateFormData.vue — required-field emission that feeds AccountUpdate.vue\'s createDisabled', () => {
  beforeEach(() => {
    refs.firstAccountId.value = '';
    refs.firstAccountKey.value = null;
    vi.clearAllMocks();
  });

  test('starts with empty account ids and a null key once enabled — the required-field-empty state', async () => {
    const wrapper = mountField();
    await enableMultipleAccounts(wrapper);

    const emitted = lastMultipleAccountsEmit(wrapper);
    expect(emitted?.accountIds).toEqual([]);
    expect(emitted?.key).toBeNull();
  });

  test('reports the parsed account ids as soon as the account-id input has a value', async () => {
    const wrapper = mountField();
    await enableMultipleAccounts(wrapper);

    wrapper.findComponent(AppInputStub).vm.$emit('update:modelValue', '0.0.100, 0.0.101');
    await flushPromises();

    expect(lastMultipleAccountsEmit(wrapper)?.accountIds).toEqual(['0.0.100', '0.0.101']);
  });
});
