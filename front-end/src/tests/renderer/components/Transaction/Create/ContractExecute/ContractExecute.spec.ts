// @vitest-environment happy-dom
import { describe, test, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import {
  AccountId,
  ContractExecuteTransaction,
  ContractId,
  Hbar,
  Timestamp,
  TransactionId,
} from '@hiero-ledger/sdk';

import ContractExecute from '@renderer/components/Transaction/Create/ContractExecute';
import ContractExecuteDirect from '@renderer/components/Transaction/Create/ContractExecute/ContractExecute.vue';

vi.mock('@renderer/components/Transaction/Create/BaseTransaction', () => ({
  default: {
    name: 'BaseTransaction',
    props: ['transactionCtor', 'createTransaction', 'getAllData', 'createDisabled'],
    emits: ['draft-loaded'],
    data: () => ({ payerInfo: { payerId: '' } }),
    template: '<div><slot /></div>',
  },
}));

vi.mock(
  '@renderer/components/Transaction/Create/ContractExecute/ContractExecuteFormData.vue',
  () => ({
    default: {
      name: 'ContractExecuteFormData',
      props: ['data', 'payerId'],
      emits: ['update:data'],
      template: '<div data-testid="form-stub" />',
    },
  }),
);

const ARG = { name: 'amount', type: 'uint256', value: '5' };

function setup() {
  const wrapper = mount(ContractExecute);
  const base = wrapper.findComponent({ name: 'BaseTransaction' });
  const form = () => wrapper.findComponent({ name: 'ContractExecuteFormData' });
  const patch = async (partial: Record<string, unknown>) => {
    form().vm.$emit('update:data', { ...form().props('data'), ...partial });
    await wrapper.vm.$nextTick();
  };
  const disabled = () => base.props('createDisabled') as boolean;
  return { wrapper, base, form, patch, disabled };
}

describe('ContractExecute.vue', () => {
  test('index re-exports the component', () => {
    expect(ContractExecute).toBe(ContractExecuteDirect);
  });

  test('configures BaseTransaction for ContractExecuteTransaction with defaults', () => {
    const { base, form } = setup();
    expect(base.props('transactionCtor')).toBe(ContractExecuteTransaction);
    expect(form().props('data')).toMatchObject({
      contractId: '',
      gas: 100000,
      functionName: '',
      functionArgs: [],
    });
  });

  test('passes the current payer id to the form (empty until known)', async () => {
    const { base, form } = setup();
    expect(form().props('payerId')).toBe('');
    (base.vm).payerInfo.payerId = '0.0.77';
    await base.vm.$nextTick();
    expect(form().props('payerId')).toBe('0.0.77');
  });

  describe('create button gating', () => {
    test('disabled initially', () => {
      expect(setup().disabled()).toBe(true);
    });

    test('disabled while any requirement is missing, enabled when all hold', async () => {
      const { patch, disabled } = setup();
      await patch({ contractId: '0.0.1001' });
      expect(disabled()).toBe(true); // no function
      await patch({ functionName: 'mint', functionArgs: [{ ...ARG, value: '' }] });
      expect(disabled()).toBe(true); // args not encodable
      await patch({ functionArgs: [ARG], gas: 0 });
      expect(disabled()).toBe(true); // gas <= 0
      await patch({ gas: 1000 });
      expect(disabled()).toBe(false);
      await patch({ contractId: 'garbage' });
      expect(disabled()).toBe(true); // invalid contract reference
    });
  });

  test('createTransaction builds a ContractExecuteTransaction from common + form data', async () => {
    const { base, patch } = setup();
    await patch({
      contractId: '0.0.1001',
      gas: 123456,
      functionName: 'mint',
      functionArgs: [ARG],
      payableAmount: new Hbar(0),
    });
    const create = base.props('createTransaction') as (c: unknown) => ContractExecuteTransaction;
    const tx = create({
      payerId: '0.0.2',
      validStart: new Date('2026-01-01T00:00:00Z'),
      maxTransactionFee: new Hbar(2),
      transactionMemo: 'memo',
    });
    expect(tx).toBeInstanceOf(ContractExecuteTransaction);
    expect(tx.contractId?.toString()).toBe('0.0.1001');
    expect(tx.gas?.toString()).toBe('123456');
    expect(tx.transactionMemo).toBe('memo');
    expect(tx.functionParameters?.length).toBe(4 + 32);
  });

  test('getAllData merges common data with contract execute data', () => {
    const { base } = setup();
    const tx = new ContractExecuteTransaction()
      .setTransactionId(
        TransactionId.withValidStart(
          AccountId.fromString('0.0.2'),
          Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
        ),
      )
      .setContractId(ContractId.fromString('0.0.1001'))
      .setGas(777)
      .setTransactionMemo('hello');
    const getAll = base.props('getAllData') as (t: ContractExecuteTransaction) => any;
    const all = getAll(tx);
    expect(all).toMatchObject({
      payerId: '0.0.2',
      transactionMemo: 'hello',
      contractId: '0.0.1001',
      gas: 777,
      functionName: '',
      functionArgs: [],
    });
  });

  test('a loaded draft restores contract id, gas and payable amount into the form', async () => {
    const { base, form } = setup();
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString('0.0.4242'))
      .setGas(55)
      .setPayableAmount(new Hbar(3))
      .setFunctionParameters(new Uint8Array([1, 2, 3, 4]));
    base.vm.$emit('draft-loaded', tx);
    await base.vm.$nextTick();
    const data = form().props('data');
    expect(data.contractId).toBe('0.0.4242');
    expect(data.gas).toBe(55);
    expect(data.payableAmount.toBigNumber().toNumber()).toBe(3);
    expect(data.rawFunctionParametersHex).toBe('01020304');
  });
});
