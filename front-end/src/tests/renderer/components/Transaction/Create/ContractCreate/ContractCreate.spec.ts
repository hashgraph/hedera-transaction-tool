// @vitest-environment happy-dom
import { describe, test, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import {
  AccountId,
  ContractCreateTransaction,
  Hbar,
  Timestamp,
  TransactionId,
} from '@hiero-ledger/sdk';

import ContractCreate from '@renderer/components/Transaction/Create/ContractCreate';
import ContractCreateDirect from '@renderer/components/Transaction/Create/ContractCreate/ContractCreate.vue';
import { TRANSACTION_MAX_SIZE } from '@shared/constants';
import { CONTRACT_CREATE_OVERHEAD_BYTES } from '@renderer/utils/sdk/privilegedPayer';

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
  '@renderer/components/Transaction/Create/ContractCreate/ContractCreateFormData.vue',
  () => ({
    default: {
      name: 'ContractCreateFormData',
      props: ['data', 'payerId', 'needsBytecodeReupload'],
      emits: ['update:data'],
      template: '<div data-testid="form-stub" />',
    },
  }),
);

function setup() {
  const wrapper = mount(ContractCreate);
  const base = wrapper.findComponent({ name: 'BaseTransaction' });
  const form = () => wrapper.findComponent({ name: 'ContractCreateFormData' });
  const patch = async (partial: Record<string, unknown>) => {
    form().vm.$emit('update:data', { ...form().props('data'), ...partial });
    await wrapper.vm.$nextTick();
  };
  const disabled = () => base.props('createDisabled') as boolean;
  return { wrapper, base, form, patch, disabled };
}

describe('ContractCreate.vue', () => {
  test('index re-exports the component', () => {
    expect(ContractCreate).toBe(ContractCreateDirect);
  });

  test('configures BaseTransaction for ContractCreateTransaction with defaults', () => {
    const { base, form } = setup();
    expect(base.props('transactionCtor')).toBe(ContractCreateTransaction);
    expect(form().props('data')).toMatchObject({
      bytecodeSource: 'inline',
      bytecodeHex: '',
      bytecodeFileId: '',
      adminKey: null,
      gas: 1000000,
      constructorArgs: [],
    });
    expect(form().props('needsBytecodeReupload')).toBe(false);
  });

  test('passes the current payer id to the form (empty until known)', async () => {
    const { base, form } = setup();
    expect(form().props('payerId')).toBe('');
    (base.vm).payerInfo.payerId = '0.0.77';
    await base.vm.$nextTick();
    expect(form().props('payerId')).toBe('0.0.77');
  });

  describe('create button gating', () => {
    test('disabled initially (no bytecode)', () => {
      expect(setup().disabled()).toBe(true);
    });

    test('inline bytecode: disabled while any requirement is missing, enabled when all hold', async () => {
      const { patch, disabled } = setup();
      await patch({ bytecodeHex: '6080604052', gas: 0 });
      expect(disabled()).toBe(true); // gas <= 0
      await patch({ gas: 100000 });
      expect(disabled()).toBe(false);
      await patch({
        constructorArgs: [{ name: 'x', type: 'uint256', value: '' }],
      });
      expect(disabled()).toBe(true); // arg incomplete
      await patch({ constructorArgs: [{ name: 'x', type: 'uint256', value: 'not-a-number' }] });
      expect(disabled()).toBe(true); // arg invalid (fails validateFunctionArgValue)
      await patch({ constructorArgs: [{ name: 'x', type: 'uint256', value: '5' }] });
      expect(disabled()).toBe(false);
    });

    test('inline bytecode over the size limit is disabled', async () => {
      const { patch, disabled } = setup();
      const maxBytes = TRANSACTION_MAX_SIZE - CONTRACT_CREATE_OVERHEAD_BYTES;
      await patch({ bytecodeHex: '00'.repeat(maxBytes + 1), gas: 100000 });
      expect(disabled()).toBe(true);
    });

    test('file bytecode source: requires a valid File ID instead of bytecodeHex', async () => {
      const { patch, disabled } = setup();
      await patch({ bytecodeSource: 'file', gas: 100000 });
      expect(disabled()).toBe(true); // no file id
      await patch({ bytecodeFileId: 'garbage' });
      expect(disabled()).toBe(true); // invalid file id
      await patch({ bytecodeFileId: '0.0.150' });
      expect(disabled()).toBe(false);
    });
  });

  test('createTransaction builds a ContractCreateTransaction from common + form data', async () => {
    const { base, patch } = setup();
    await patch({
      bytecodeHex: '6080604052',
      gas: 123456,
      contractMemo: 'my contract',
    });
    const create = base.props('createTransaction') as (c: unknown) => ContractCreateTransaction;
    const tx = create({
      payerId: '0.0.2',
      validStart: new Date('2026-01-01T00:00:00Z'),
      maxTransactionFee: new Hbar(2),
      transactionMemo: 'memo',
    });
    expect(tx).toBeInstanceOf(ContractCreateTransaction);
    expect(tx.gas?.toString()).toBe('123456');
    expect(tx.contractMemo).toBe('my contract');
    expect(tx.transactionMemo).toBe('memo');
  });

  test('getAllData merges common data with contract create data', () => {
    const { base } = setup();
    const tx = new ContractCreateTransaction()
      .setTransactionId(
        TransactionId.withValidStart(
          AccountId.fromString('0.0.2'),
          Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
        ),
      )
      .setGas(777)
      .setBytecodeFileId('0.0.150')
      .setTransactionMemo('hello');
    const getAll = base.props('getAllData') as (t: ContractCreateTransaction) => any;
    const all = getAll(tx);
    expect(all).toMatchObject({
      payerId: '0.0.2',
      transactionMemo: 'hello',
      gas: 777,
      bytecodeSource: 'file',
      bytecodeFileId: '0.0.150',
    });
  });

  test('a loaded draft restores recovered fields and flags inline bytecode re-upload when it was lost', async () => {
    const { base, form } = setup();
    const tx = new ContractCreateTransaction().setGas(55).setContractMemo('reloaded');
    base.vm.$emit('draft-loaded', tx);
    await base.vm.$nextTick();
    const data = form().props('data');
    expect(data.gas).toBe(55);
    expect(data.contractMemo).toBe('reloaded');
    expect(data.bytecodeSource).toBe('inline');
    expect(form().props('needsBytecodeReupload')).toBe(true);
  });

  test('a loaded draft with file-based bytecode does not flag re-upload', async () => {
    const { base, form } = setup();
    const tx = new ContractCreateTransaction().setBytecodeFileId('0.0.150');
    base.vm.$emit('draft-loaded', tx);
    await base.vm.$nextTick();
    expect(form().props('needsBytecodeReupload')).toBe(false);
  });
});
