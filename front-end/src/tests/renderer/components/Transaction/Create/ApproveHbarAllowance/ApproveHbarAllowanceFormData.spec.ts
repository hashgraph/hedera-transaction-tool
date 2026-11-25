// @vitest-environment happy-dom
import { describe, test, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { AccountId, Hbar } from '@hiero-ledger/sdk';

import type { ApproveHbarAllowanceData } from '@renderer/utils/sdk';
import type { CryptoAllowance, IAccountInfoParsed } from '@shared/interfaces';

import ApproveHbarAllowanceFormData from '@renderer/components/Transaction/Create/ApproveHbarAllowance/ApproveHbarAllowanceFormData.vue';

/* Mocks */
vi.mock('@renderer/stores/storeNetwork', () => ({ default: () => ({ client: null }) }));

const AppInputStub = {
  name: 'AppInput',
  props: ['modelValue', 'filled', 'placeholder'],
  emits: ['update:modelValue', 'blur'],
  template: '<input />',
};
const AppHbarInputStub = {
  name: 'AppHbarInput',
  props: ['modelValue', 'filled', 'placeholder'],
  emits: ['update:modelValue'],
  template: '<div />',
};

/* Fixtures */
const baseData = (overrides: Partial<ApproveHbarAllowanceData> = {}): ApproveHbarAllowanceData =>
  ({
    ownerAccountId: '',
    spenderAccountId: '',
    amount: new Hbar(0),
    ...overrides,
  });

const mountForm = (
  props: Partial<{
    ownerInfo: IAccountInfoParsed | null;
    ownerAllowances: CryptoAllowance[];
    spenderInfo: IAccountInfoParsed | null;
    data: ApproveHbarAllowanceData;
  }> = {},
) =>
  mount(ApproveHbarAllowanceFormData, {
    props: {
      ownerInfo: null,
      ownerAllowances: [],
      spenderInfo: null,
      data: baseData(),
      ...props,
    },
    global: {
      stubs: { AppInput: AppInputStub, AppHbarInput: AppHbarInputStub },
    },
  });

const owner = (w: ReturnType<typeof mountForm>) =>
  w.findComponent('[data-testid="input-owner-account"]');
const spender = (w: ReturnType<typeof mountForm>) =>
  w.findComponent('[data-testid="input-spender-account"]');
const amount = (w: ReturnType<typeof mountForm>) =>
  w.findComponent('[data-testid="input-allowance-amount"]');

describe('ApproveHbarAllowanceFormData', () => {
  test('emits update:data with a formatted owner id, dropping any checksum suffix', async () => {
    const data = baseData({ spenderAccountId: '0.0.5' });
    const wrapper = mountForm({ data });

    await owner(wrapper).vm.$emit('update:modelValue', '0.0.1234-abcde');

    expect(wrapper.emitted('update:data')).toEqual([[{ ...data, ownerAccountId: '0.0.1234' }]]);
  });

  test('emits update:data with a formatted spender id, preserving the other fields', async () => {
    const data = baseData({ ownerAccountId: '0.0.7', amount: new Hbar(3) });
    const wrapper = mountForm({ data });

    await spender(wrapper).vm.$emit('update:modelValue', '0.0.99');

    expect(wrapper.emitted('update:data')).toEqual([[{ ...data, spenderAccountId: '0.0.99' }]]);
  });

  test('emits update:data with the entered hbar amount', async () => {
    const data = baseData({ ownerAccountId: '0.0.7', spenderAccountId: '0.0.8' });
    const wrapper = mountForm({ data });

    await amount(wrapper).vm.$emit('update:modelValue', new Hbar(10));

    expect(wrapper.emitted('update:data')).toEqual([[{ ...data, amount: new Hbar(10) }]]);
  });

  test('passes the current amount to the hbar input', () => {
    const wrapper = mountForm({ data: baseData({ amount: new Hbar(10) }) });

    expect(amount(wrapper).props('modelValue')).toEqual(new Hbar(10));
  });

  test('populates owner and spender inputs once when the data first contains both ids', async () => {
    const wrapper = mountForm();

    expect(owner(wrapper).props('modelValue')).toBe('');
    expect(spender(wrapper).props('modelValue')).toBe('');

    await wrapper.setProps({
      data: baseData({ ownerAccountId: '0.0.11', spenderAccountId: '0.0.22' }),
    });

    expect(owner(wrapper).props('modelValue')).toBe('0.0.11');
    expect(spender(wrapper).props('modelValue')).toBe('0.0.22');

    // Later prop changes must not overwrite what the user is typing
    await wrapper.setProps({
      data: baseData({ ownerAccountId: '0.0.33', spenderAccountId: '0.0.44' }),
    });

    expect(owner(wrapper).props('modelValue')).toBe('0.0.11');
    expect(spender(wrapper).props('modelValue')).toBe('0.0.22');
  });

  test('does not populate inputs while only one of the ids is present', async () => {
    const wrapper = mountForm({ data: baseData({ ownerAccountId: '0.0.11' }) });

    expect(owner(wrapper).props('modelValue')).toBe('');
    expect(spender(wrapper).props('modelValue')).toBe('');
  });

  test('shows the owner balance, or a dash when the owner is unknown', () => {
    const withoutOwner = mountForm();
    expect(withoutOwner.text()).toContain('Balance: -');

    const withOwner = mountForm({
      ownerInfo: { balance: new Hbar(5), key: null } as unknown as IAccountInfoParsed,
    });
    expect(withOwner.text()).toContain('Balance: 5');
  });

  test("shows the spender's existing allowance from the owner's allowances", () => {
    const wrapper = mountForm({
      spenderInfo: { accountId: AccountId.fromString('0.0.22'), key: null } as IAccountInfoParsed,
      ownerAllowances: [
        { spender: '0.0.99', amount: Hbar.from(1).toTinybars().toNumber() },
        { spender: '0.0.22', amount: Hbar.from(7).toTinybars().toNumber() },
      ] as unknown as CryptoAllowance[],
    });

    expect(wrapper.text()).toContain('Allowance: 7');
  });

  test('shows a zero allowance when the spender has none, and hides it when spender is unknown', () => {
    const known = mountForm({
      spenderInfo: { accountId: AccountId.fromString('0.0.22'), key: null } as IAccountInfoParsed,
    });
    expect(known.text()).toContain('Allowance: 0');

    const unknown = mountForm();
    expect(unknown.text()).not.toContain('Allowance:');
  });

  test('shows Show Key buttons only for accounts that have a key', () => {
    const none = mountForm({
      ownerInfo: { key: null } as unknown as IAccountInfoParsed,
      spenderInfo: { key: null } as unknown as IAccountInfoParsed,
    });
    expect(none.findAll('button')).toHaveLength(0);

    const both = mountForm({
      ownerInfo: { key: {} } as unknown as IAccountInfoParsed,
      spenderInfo: { key: {} } as unknown as IAccountInfoParsed,
    });
    expect(both.findAll('button')).toHaveLength(2);
  });
});
