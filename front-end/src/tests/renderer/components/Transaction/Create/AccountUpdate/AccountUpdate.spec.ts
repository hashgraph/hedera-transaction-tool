// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { computed, ref } from 'vue';
import { AccountId, AccountUpdateTransaction, EvmAddress, Hbar, PrivateKey, Transaction } from '@hiero-ledger/sdk';

import type { IAccountInfoParsed } from '@shared/interfaces';
import { getAccountUpdateData, type TransactionCommonData } from '@renderer/utils/sdk';

// Module-level mock state, closed over by the `vi.mock` factories below and
// only deref'd once AccountUpdate's setup actually calls the mocked composable.
const refs = {
  accountId: ref<string>(''),
  accountInfo: ref<IAccountInfoParsed | null>(null),
};
let mockRouteQuery: Record<string, string | undefined> = {};

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mockRouteQuery }),
}));

vi.mock('@renderer/composables/useAccountId', () => ({
  default: () => ({
    accountId: refs.accountId,
    accountInfo: refs.accountInfo,
    // A real computed, not a one-shot snapshot: the createDisabled tests need
    // this to track refs.accountInfo as it changes after mount.
    isValid: computed(() => refs.accountInfo.value !== null),
    key: ref(null),
  }),
}));

vi.mock('@renderer/components/Transaction/Create/BaseTransaction', () => ({
  default: {
    name: 'BaseTransaction',
    props: ['createTransaction', 'createDisabled', 'preCreateAssert', 'customRequest'],
    emits: ['executed:success', 'draft-loaded'],
    // AccountUpdate.vue's `[data.accountId, data.ownerKey]` watcher calls
    // `baseTransactionRef.value?.updateTransactionKey()`. Expose a no-op so
    // that call doesn't throw.
    methods: { updateTransactionKey() {} },
    template: '<div><slot /></div>',
  },
}));

vi.mock(
  '@renderer/components/Transaction/Create/AccountUpdate/AccountUpdateFormData.vue',
  () => ({
    default: {
      name: 'AccountUpdateFormData',
      props: ['data', 'accountInfo', 'multipleAccountsData'],
      emits: ['update:data', 'update:multiple-accounts-data'],
      template: '<div data-testid="form-stub"></div>',
    },
  }),
);

import AccountUpdate from '@renderer/components/Transaction/Create/AccountUpdate/AccountUpdate.vue';

const key1 = PrivateKey.generateED25519().publicKey;
const key2 = PrivateKey.generateED25519().publicKey;

function makeAccountInfo(overrides: Partial<IAccountInfoParsed> = {}): IAccountInfoParsed {
  return {
    accountId: AccountId.fromString('0.0.100'),
    alias: null,
    balance: new Hbar(0),
    declineReward: false,
    deleted: false,
    ethereumNonce: 0,
    evmAddress: EvmAddress.fromString('0x0000000000000000000000000000000000000000'),
    createdTimestamp: null,
    expiryTimestamp: null,
    key: key1,
    maxAutomaticTokenAssociations: 0,
    memo: '',
    pendingRewards: new Hbar(0),
    receiverSignatureRequired: false,
    stakedAccountId: null,
    stakedNodeId: null,
    autoRenewPeriod: null,
    ...overrides,
  };
}

async function mountAndSettle() {
  const wrapper = mount(AccountUpdate);
  await flushPromises();
  return wrapper;
}

function readSeededData(wrapper: ReturnType<typeof mount>) {
  return wrapper.findComponent({ name: 'AccountUpdateFormData' }).props('data') as {
    accountId: string;
    ownerKey: unknown;
  };
}

async function emitUpdateData(
  wrapper: ReturnType<typeof mount>,
  overrides: Record<string, unknown>,
) {
  const base = wrapper.findComponent({ name: 'AccountUpdateFormData' }).props('data') as Record<
    string,
    unknown
  >;
  wrapper
    .findComponent({ name: 'AccountUpdateFormData' })
    .vm.$emit('update:data', { ...base, ...overrides });
  await flushPromises();
}

async function emitMultipleAccountsData(
  wrapper: ReturnType<typeof mount>,
  data: { accountIds: string[]; accountIsPayer: boolean; key: unknown },
) {
  wrapper
    .findComponent({ name: 'AccountUpdateFormData' })
    .vm.$emit('update:multiple-accounts-data', data);
  await flushPromises();
}

function readCreateDisabled(wrapper: ReturnType<typeof mount>) {
  return wrapper.findComponent({ name: 'BaseTransaction' }).props('createDisabled') as boolean;
}

function readCreateTransaction(wrapper: ReturnType<typeof mount>) {
  return wrapper
    .findComponent({ name: 'BaseTransaction' })
    .props('createTransaction') as (common: TransactionCommonData) => AccountUpdateTransaction;
}

describe('AccountUpdate.vue — ownerKey seeding vs. manual-edit guard', () => {
  beforeEach(() => {
    mockRouteQuery = {};
    refs.accountId.value = '';
    refs.accountInfo.value = null;
    vi.clearAllMocks();
  });

  test('seeds data.ownerKey from accountInfo.key when a brand-new account loads', async () => {
    const wrapper = await mountAndSettle();

    refs.accountInfo.value = makeAccountInfo({ key: key1 });
    await flushPromises();

    expect(readSeededData(wrapper).ownerKey).toStrictEqual(key1);
  });

  test('resets data.ownerKey to null when the account is cleared', async () => {
    const wrapper = await mountAndSettle();

    refs.accountInfo.value = makeAccountInfo({ key: key1 });
    await flushPromises();
    expect(readSeededData(wrapper).ownerKey).toStrictEqual(key1);

    refs.accountInfo.value = null;
    await flushPromises();

    expect(readSeededData(wrapper).ownerKey).toBeNull();
  });

  test('does not clobber a manually-selected ownerKey when accountInfo re-fires for the same account', async () => {
    const wrapper = await mountAndSettle();

    refs.accountInfo.value = makeAccountInfo({ key: key1 });
    await flushPromises();
    expect(readSeededData(wrapper).ownerKey).toStrictEqual(key1);

    // Same accountId, different ownerKey: the user picked a key manually
    // (e.g. via KeyField's "Select Key").
    await emitUpdateData(wrapper, { ownerKey: key2 });
    expect(readSeededData(wrapper).ownerKey).toStrictEqual(key2);

    // The account info watcher re-fires for the *same* account (e.g. a
    // mirror-node refresh), still reporting the original key1. This must
    // not overwrite the user's manual choice.
    refs.accountInfo.value = makeAccountInfo({ key: key1 });
    await flushPromises();

    expect(readSeededData(wrapper).ownerKey).toStrictEqual(key2);
  });

  test('re-arms seeding when a different account is selected after a manual key edit', async () => {
    const wrapper = await mountAndSettle();

    refs.accountInfo.value = makeAccountInfo({ key: key1 });
    await flushPromises();

    await emitUpdateData(wrapper, { ownerKey: key2 });
    expect(readSeededData(wrapper).ownerKey).toStrictEqual(key2);

    // User switches to a different account: accountId changes, which should
    // clear the manual-edit guard so the new account's key gets seeded.
    await emitUpdateData(wrapper, { accountId: '0.0.200', ownerKey: key2 });
    refs.accountInfo.value = makeAccountInfo({
      accountId: AccountId.fromString('0.0.200'),
      key: key1,
    });
    await flushPromises();

    expect(readSeededData(wrapper).ownerKey).toStrictEqual(key1);
  });
});

describe('AccountUpdate.vue — createDisabled (required-field gating)', () => {
  beforeEach(() => {
    mockRouteQuery = {};
    refs.accountId.value = '';
    refs.accountInfo.value = null;
    vi.clearAllMocks();
  });

  test('disabled when no account id has been entered', async () => {
    const wrapper = await mountAndSettle();
    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  test('disabled while the account id is entered but has not resolved to a real account', async () => {
    const wrapper = await mountAndSettle();
    await emitUpdateData(wrapper, { accountId: '0.0.100' });
    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  test('enabled once the account resolves and no stake target is required', async () => {
    const wrapper = await mountAndSettle();
    await emitUpdateData(wrapper, { accountId: '0.0.100' });
    refs.accountInfo.value = makeAccountInfo({ accountId: AccountId.fromString('0.0.100') });
    await flushPromises();
    expect(readCreateDisabled(wrapper)).toBe(false);
  });

  test('disabled when stakeType is Account but no staked account id is entered', async () => {
    const wrapper = await mountAndSettle();
    await emitUpdateData(wrapper, { accountId: '0.0.100' });
    refs.accountInfo.value = makeAccountInfo({ accountId: AccountId.fromString('0.0.100') });
    await flushPromises();

    await emitUpdateData(wrapper, { stakeType: 'Account', stakedAccountId: '' });
    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  test('enabled once a staked account id is entered for stakeType Account', async () => {
    const wrapper = await mountAndSettle();
    await emitUpdateData(wrapper, { accountId: '0.0.100' });
    refs.accountInfo.value = makeAccountInfo({ accountId: AccountId.fromString('0.0.100') });
    await flushPromises();

    await emitUpdateData(wrapper, { stakeType: 'Account', stakedAccountId: '0.0.200' });
    expect(readCreateDisabled(wrapper)).toBe(false);
  });

  test('disabled when stakeType is Node but no node id is selected', async () => {
    const wrapper = await mountAndSettle();
    await emitUpdateData(wrapper, { accountId: '0.0.100' });
    refs.accountInfo.value = makeAccountInfo({ accountId: AccountId.fromString('0.0.100') });
    await flushPromises();

    await emitUpdateData(wrapper, { stakeType: 'Node', stakedNodeId: null });
    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  test('enabled once a node id is selected for stakeType Node', async () => {
    const wrapper = await mountAndSettle();
    await emitUpdateData(wrapper, { accountId: '0.0.100' });
    refs.accountInfo.value = makeAccountInfo({ accountId: AccountId.fromString('0.0.100') });
    await flushPromises();

    await emitUpdateData(wrapper, { stakeType: 'Node', stakedNodeId: 5 });
    expect(readCreateDisabled(wrapper)).toBe(false);
  });

  test('multiple accounts: disabled when no account ids have been selected', async () => {
    const wrapper = await mountAndSettle();
    await emitMultipleAccountsData(wrapper, {
      accountIds: [],
      accountIsPayer: false,
      key: key1,
    });
    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  test('multiple accounts: disabled when no key has been resolved', async () => {
    const wrapper = await mountAndSettle();
    await emitMultipleAccountsData(wrapper, {
      accountIds: ['0.0.100'],
      accountIsPayer: false,
      key: null,
    });
    expect(readCreateDisabled(wrapper)).toBe(true);
  });

  test('multiple accounts: enabled once account ids and a key are both present', async () => {
    const wrapper = await mountAndSettle();
    await emitMultipleAccountsData(wrapper, {
      accountIds: ['0.0.100'],
      accountIsPayer: false,
      key: key1,
    });
    expect(readCreateDisabled(wrapper)).toBe(false);
  });
});

describe('AccountUpdate.vue — createTransaction (form data reaches the transaction bytes)', () => {
  beforeEach(() => {
    mockRouteQuery = {};
    refs.accountId.value = '';
    refs.accountInfo.value = null;
    vi.clearAllMocks();
  });

  test('builds an AccountUpdateTransaction once the required fields are filled in', async () => {
    const wrapper = await mountAndSettle();
    await emitUpdateData(wrapper, { accountId: '0.0.100' });
    refs.accountInfo.value = makeAccountInfo({ accountId: AccountId.fromString('0.0.100') });
    await flushPromises();
    expect(readCreateDisabled(wrapper)).toBe(false);

    const common: TransactionCommonData = {
      payerId: '0.0.1001',
      validStart: new Date(),
      maxTransactionFee: new Hbar(5),
      transactionMemo: '',
    };
    const transaction = readCreateTransaction(wrapper)(common);

    expect(transaction).toBeInstanceOf(AccountUpdateTransaction);
    expect(transaction.accountId?.toString()).toBe('0.0.100');
  });

  test('every field entered in the form ends up in the transaction, and survives a bytes round trip', async () => {
    const wrapper = await mountAndSettle();

    // Resolve the account being updated — its *old* on-chain values — so the
    // seeding watcher populates `data` with a baseline that the user then
    // edits away from.
    await emitUpdateData(wrapper, { accountId: '0.0.100' });
    refs.accountInfo.value = makeAccountInfo({
      accountId: AccountId.fromString('0.0.100'),
      key: key1,
      receiverSignatureRequired: false,
      declineReward: false,
      maxAutomaticTokenAssociations: 0,
      memo: '',
    });
    await flushPromises();

    // The user fills in every field with a value different from the
    // account's current on-chain state, so each setter actually fires.
    await emitUpdateData(wrapper, {
      ownerKey: key2,
      receiverSignatureRequired: true,
      declineStakingReward: true,
      maxAutomaticTokenAssociations: 25,
      accountMemo: 'updated via form',
      stakeType: 'Account',
      stakedAccountId: '0.0.300',
    });
    expect(readCreateDisabled(wrapper)).toBe(false);

    const common: TransactionCommonData = {
      payerId: '0.0.1001',
      validStart: new Date(),
      maxTransactionFee: new Hbar(5),
      transactionMemo: 'paying for the update',
    };
    const transaction = readCreateTransaction(wrapper)(common);

    expect(transaction.accountId?.toString()).toBe('0.0.100');
    expect(transaction.key?.toString()).toBe(key2.toString());
    expect(transaction.receiverSignatureRequired).toBe(true);
    expect(transaction.declineStakingRewards).toBe(true);
    expect(transaction.maxAutomaticTokenAssociations?.toNumber()).toBe(25);
    expect(transaction.accountMemo).toBe('updated via form');
    expect(transaction.stakedAccountId?.toString()).toBe('0.0.300');

    // Freeze and serialize, then decode independently and re-derive form
    // data from the raw bytes — proving the values genuinely made it onto
    // the wire, not just onto the in-memory Transaction object.
    transaction.setNodeAccountIds([AccountId.fromString('0.0.3')]);
    transaction.freeze();
    const decoded = Transaction.fromBytes(transaction.toBytes());
    expect(decoded instanceof AccountUpdateTransaction).toBe(true);
    const decodedData = getAccountUpdateData(decoded as AccountUpdateTransaction);

    expect(decodedData.accountId).toBe('0.0.100');
    expect(decodedData.ownerKey?.toString()).toBe(key2.toString());
    expect(decodedData.receiverSignatureRequired).toBe(true);
    expect(decodedData.declineStakingReward).toBe(true);
    expect(decodedData.maxAutomaticTokenAssociations).toBe(25);
    expect(decodedData.accountMemo).toBe('updated via form');
    expect(decodedData.stakedAccountId).toBe('0.0.300');
  });
});
