// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { AccountAllowanceApproveTransaction, Hbar } from '@hiero-ledger/sdk';

import type { ApproveHbarAllowanceData } from '@renderer/utils/sdk';

import {
  createApproveHbarAllowanceTransaction,
  type TransactionCommonData,
} from '@renderer/utils/sdk/createTransactions';

import ApproveHbarAllowanceFormData from '@renderer/components/Transaction/Create/ApproveHbarAllowance/ApproveHbarAllowanceFormData.vue';

const common: TransactionCommonData = {
  payerId: '0.0.2',
  validStart: new Date(Date.now() + 60_000),
  maxTransactionFee: new Hbar(2),
  transactionMemo: '',
};

function makeData(overrides: Partial<ApproveHbarAllowanceData> = {}): ApproveHbarAllowanceData {
  return {
    ownerAccountId: '',
    spenderAccountId: '',
    amount: new Hbar(0),
    ...overrides,
  };
}

function mountForm(data: ApproveHbarAllowanceData = makeData()) {
  return mount(ApproveHbarAllowanceFormData, {
    props: { data, ownerInfo: null, spenderInfo: null, ownerAllowances: [] },
  });
}

async function applyLastEmit(wrapper: ReturnType<typeof mountForm>) {
  const events = wrapper.emitted('update:data');
  const last = events?.[events.length - 1]?.[0] as ApproveHbarAllowanceData;
  await wrapper.setProps({ data: last });
  return last;
}

// Amount always holds a value (0 by default, which the network treats as a revoke), so it is
// not a required input — only owner and spender have to be entered.
describe('ApproveHbarAllowanceFormData.vue — entering owner, spender and amount', () => {
  test('produces a valid hbar allowance approval transaction', async () => {
    const wrapper = mountForm();

    await wrapper.find('[data-testid="input-owner-account"]').setValue('0.0.10');
    await applyLastEmit(wrapper);

    await wrapper.find('[data-testid="input-spender-account"]').setValue('0.0.11');
    await applyLastEmit(wrapper);

    await wrapper.find('[data-testid="input-allowance-amount"]').setValue('5');
    const data = await applyLastEmit(wrapper);

    const tx = createApproveHbarAllowanceTransaction({ ...common, ...data });
    expect(tx).toBeInstanceOf(AccountAllowanceApproveTransaction);
    expect(tx.hbarApprovals).toHaveLength(1);
    expect(tx.hbarApprovals[0].ownerAccountId?.toString()).toBe('0.0.10');
    expect(tx.hbarApprovals[0].spenderAccountId?.toString()).toBe('0.0.11');
    expect(tx.hbarApprovals[0].amount?.toBigNumber().toNumber()).toBe(5);
  });

  test('leaving the amount untouched approves 0', async () => {
    const wrapper = mountForm();

    await wrapper.find('[data-testid="input-owner-account"]').setValue('0.0.10');
    await applyLastEmit(wrapper);
    await wrapper.find('[data-testid="input-spender-account"]').setValue('0.0.11');
    const data = await applyLastEmit(wrapper);

    const tx = createApproveHbarAllowanceTransaction({ ...common, ...data });
    expect(tx.hbarApprovals[0].amount?.toBigNumber().toNumber()).toBe(0);
  });

  test('does not mark the amount as required', () => {
    const wrapper = mountForm();
    const amountLabel = wrapper.findAll('label').find(l => l.text().startsWith('Amount'));

    expect(amountLabel).toBeDefined();
    expect(amountLabel!.find('.text-danger').exists()).toBe(false);
  });
});
