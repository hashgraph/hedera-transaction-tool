// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import { AccountId, ContractId, Hbar } from '@hiero-ledger/sdk';

import type { ContractExecuteData } from '@renderer/utils/sdk';

import ContractExecuteFormData from '@renderer/components/Transaction/Create/ContractExecute/ContractExecuteFormData.vue';
import { buildFunctionCallData } from '@renderer/utils/sdk/contractFunctionParams';

/* Mocks */
const userState = reactive<{ personal: unknown }>({ personal: null });
const networkState = reactive({ network: 'testnet', mirrorNodeBaseURL: 'https://mirror.test' });

vi.mock('@renderer/stores/storeUser', () => ({ default: () => userState }));
vi.mock('@renderer/stores/storeNetwork', () => ({ default: () => networkState }));

const getAllMock = vi.fn();
vi.mock('@renderer/services/smartContractsService', () => ({
  getAll: (...args: unknown[]) => getAllMock(...args),
}));

const simulateContractCallMock = vi.fn();
vi.mock('@renderer/utils/sdk/contractCall', async importOriginal => {
  const actual = await importOriginal<typeof import('@renderer/utils/sdk/contractCall')>();
  return {
    ...actual,
    simulateContractCall: (...args: unknown[]) => simulateContractCallMock(...args),
  };
});

vi.mock('@renderer/components/Transaction/Create/ContractExecute/ContractIdInput.vue', () => ({
  default: {
    name: 'ContractIdInput',
    props: ['modelValue', 'items', 'placeholder'],
    emits: ['update:modelValue'],
    template: '<div />',
  },
}));
vi.mock('@renderer/components/ui/AppUploadFile.vue', () => ({
  default: {
    name: 'AppUploadFile',
    props: ['id', 'file', 'maxSizeKb', 'accept', 'showName'],
    emits: ['update:file'],
    template: '<div />',
  },
}));
vi.mock('@renderer/components/ui/AppHbarInput.vue', () => ({
  default: {
    name: 'AppHbarInput',
    props: ['modelValue', 'filled', 'placeholder'],
    emits: ['update:modelValue'],
    template: '<div />',
  },
}));
vi.mock('@renderer/components/ui/AppCheckBox.vue', () => ({
  default: {
    name: 'AppCheckBox',
    props: ['checked', 'name'],
    emits: ['update:checked'],
    template: '<div />',
  },
}));
vi.mock('@renderer/components/ui/AppInput.vue', () => ({
  default: {
    name: 'AppInput',
    props: ['modelValue', 'filled', 'type', 'min', 'placeholder', 'autoTrim'],
    emits: ['update:modelValue'],
    template: '<div />',
  },
}));

/* Fixtures */
const ABI = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  { type: 'function', name: 'deposit', inputs: [], outputs: [], stateMutability: 'payable' },
  {
    type: 'function',
    name: 'setFlag',
    inputs: [{ name: '', type: 'bool' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // callable (string is encodable) but not fully decodable for display - see
  // isCallableAbiFunction vs isFullyDecodableAbiFunction in abi.ts
  {
    type: 'function',
    name: 'setName',
    inputs: [{ name: 'n', type: 'string' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // not callable: array param, unsupported by encodeContractFunctionParams
  {
    type: 'function',
    name: 'setIds',
    inputs: [{ name: 'ids', type: 'uint256[]' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  { type: 'event', name: 'Transfer', inputs: [] },
];

const EVM = 'ab'.repeat(20);
const evmOf = (id: string) => ContractId.fromString(id).toEvmAddress();
const PAYER = '0.0.500';

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    user_id: 'u1',
    network: 'testnet',
    contract_id: '0.0.1001',
    evm_address: `0x${EVM}`,
    nickname: 'Vault',
    abi: JSON.stringify(ABI),
    ...overrides,
  };
}

function baseData(overrides: Partial<ContractExecuteData> = {}): ContractExecuteData {
  return {
    contractId: '',
    gas: 100000,
    payableAmount: new Hbar(0),
    functionName: '',
    functionArgs: [],
    ...overrides,
  };
}

type Wrapper = VueWrapper<InstanceType<typeof ContractExecuteFormData>>;

async function mountForm(
  data: Partial<ContractExecuteData> = {},
  payerId = PAYER,
  { settle = true } = {},
) {
  const emitted: ContractExecuteData[] = [];
  const wrapper: Wrapper = mount(ContractExecuteFormData, {
    props: {
      data: baseData(data),
      payerId,
      'onUpdate:data': (d: ContractExecuteData) => {
        emitted.push(d);
        wrapper.setProps({ data: d });
      },
    } as never,
  });
  if (settle) await flushPromises();
  return { wrapper, emitted };
}

const sel = (w: Wrapper) => w.find('[data-testid="select-contract-execute-function"]');

// Option values are function signatures now (to disambiguate overloads - see
// ContractExecuteFormData.vue's functionOptions) - resolve a bare name to its rendered option's
// actual value so existing callers can keep passing just the name.
async function chooseFunction(w: Wrapper, name: string) {
  const el = sel(w).element as HTMLSelectElement;
  const option = Array.from(el.options).find(o => o.value === name || o.value.startsWith(`${name}(`));
  el.value = option ? option.value : name;
  await sel(w).trigger('change');
  await flushPromises();
}

describe('ContractExecuteFormData.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userState.personal = { isLoggedIn: true, id: 'u1' };
    networkState.network = 'testnet';
    getAllMock.mockResolvedValue([makeContract()]);
    simulateContractCallMock.mockResolvedValue({ status: 'unknown' });
  });

  describe('saved contracts loading', () => {
    test('loads saved contracts for the logged-in user and network', async () => {
      const { wrapper } = await mountForm();
      expect(getAllMock).toHaveBeenCalledWith({ where: { user_id: 'u1', network: 'testnet' } });
      const items = wrapper.findComponent({ name: 'ContractIdInput' }).props('items');
      expect(items).toEqual([{ value: '0.0.1001', nickname: 'Vault' }]);
    });

    test('does not load when not logged in', async () => {
      userState.personal = null;
      const { wrapper } = await mountForm();
      expect(getAllMock).not.toHaveBeenCalled();
      expect(wrapper.findComponent({ name: 'ContractIdInput' }).props('items')).toEqual([]);
    });

    test('falls back to evm address, empty nickname, and drops entries with no identifier', async () => {
      getAllMock.mockResolvedValue([
        makeContract({ contract_id: null, nickname: null }),
        makeContract({ contract_id: null, evm_address: null }),
      ]);
      const { wrapper } = await mountForm();
      expect(wrapper.findComponent({ name: 'ContractIdInput' }).props('items')).toEqual([
        { value: `0x${EVM}`, nickname: '' },
      ]);
    });
  });

  describe('contract id handling', () => {
    test('changing the contract id resets function selection and payable amount', async () => {
      const { wrapper, emitted } = await mountForm({
        contractId: '0.0.1',
        functionName: 'deposit',
        payableAmount: new Hbar(5),
      });
      wrapper.findComponent({ name: 'ContractIdInput' }).vm.$emit('update:modelValue', '0.0.1001');
      await flushPromises();
      const last = emitted.at(-1)!;
      expect(last.contractId).toBe('0.0.1001');
      expect(last.functionName).toBe('');
      expect(last.functionArgs).toEqual([]);
      expect(last.payableAmount.toTinybars().toNumber()).toBe(0);
      expect(last.rawFunctionParametersHex).toBe('');
    });

    test.each([
      ['by contract id (case-insensitive, trimmed)', ' 0.0.1001 '],
      ['by evm address with 0x', `0x${EVM.toUpperCase()}`],
      ['by evm address without 0x', EVM],
    ])('a saved contract is selected %s: ABI upload hidden and functions listed', async (_n, id) => {
      const { wrapper } = await mountForm({ contractId: id });
      expect(wrapper.find('.invisible').exists()).toBe(true);
      const options = sel(wrapper).findAll('option').map(o => o.text());
      expect(options).toEqual([
        'Select a function',
        'mint(address, uint256)',
        'deposit()',
        'setFlag(bool)',
        'setName(string)',
      ]);
    });

    test('a saved contract with only a contract_id is recognized when entered by its equivalent EVM address', async () => {
      getAllMock.mockResolvedValue([makeContract({ contract_id: '0.0.1001', evm_address: null })]);
      const { wrapper } = await mountForm({ contractId: `0x${evmOf('0.0.1001')}` });
      expect(wrapper.find('.invisible').exists()).toBe(true);
    });

    test('a saved contract with only an evm_address is recognized when entered by an equivalent "0.0.X" id', async () => {
      getAllMock.mockResolvedValue([
        makeContract({ contract_id: null, evm_address: `0x${evmOf('0.0.1001')}` }),
      ]);
      const { wrapper } = await mountForm({ contractId: '0.0.1001' });
      expect(wrapper.find('.invisible').exists()).toBe(true);
    });

    test('unknown contract id shows the ABI upload and no functions', async () => {
      const { wrapper } = await mountForm({ contractId: '0.0.9999' });
      expect(wrapper.find('.invisible').exists()).toBe(false);
      expect(sel(wrapper).attributes('disabled')).toBeDefined();
    });

    test('empty contract id has no selected contract', async () => {
      const { wrapper } = await mountForm({ contractId: '   ' });
      expect(wrapper.find('.invisible').exists()).toBe(false);
    });

    test('a saved contract with corrupt ABI JSON yields no functions and no message', async () => {
      getAllMock.mockResolvedValue([makeContract({ abi: '{not json' })]);
      const { wrapper } = await mountForm({ contractId: '0.0.1001' });
      expect(sel(wrapper).attributes('disabled')).toBeDefined();
      expect(wrapper.text()).not.toContain('No callable functions');
    });

    test('an ABI with no callable function shows a hint', async () => {
      getAllMock.mockResolvedValue([
        makeContract({ abi: JSON.stringify([ABI[4]]) }),
      ]);
      const { wrapper } = await mountForm({ contractId: '0.0.1001' });
      expect(wrapper.text()).toContain('No callable functions found in this ABI.');
    });
  });

  describe('manual ABI upload', () => {
    const upload = (w: Wrapper, file: unknown) =>
      w.findComponent({ name: 'AppUploadFile' }).vm.$emit('update:file', file);
    const fileOf = (text: string, loadPercentage = 100) => ({
      meta: new File([text], 'abi.json'),
      content: new TextEncoder().encode(text),
      loadPercentage,
    });

    test('a valid ABI populates the function list and clears function selection', async () => {
      const { wrapper, emitted } = await mountForm({ contractId: '0.0.7777' });
      upload(wrapper, fileOf(JSON.stringify(ABI)));
      await flushPromises();
      expect(emitted.at(-1)).toMatchObject({ functionName: '', functionArgs: [] });
      expect(sel(wrapper).findAll('option')).toHaveLength(5);
      expect(wrapper.findComponent({ name: 'AppUploadFile' }).props('file')).not.toBeNull();
    });

    test('an object-wrapped (artifact) ABI is accepted', async () => {
      const { wrapper } = await mountForm({ contractId: '0.0.7777' });
      upload(wrapper, fileOf(JSON.stringify({ abi: ABI })));
      await flushPromises();
      expect(sel(wrapper).findAll('option')).toHaveLength(5);
    });

    test('invalid JSON shows the parse error and keeps no ABI', async () => {
      const { wrapper } = await mountForm({ contractId: '0.0.7777' });
      upload(wrapper, fileOf('nope'));
      await flushPromises();
      expect(wrapper.text()).toContain('File is not valid JSON');
      expect(sel(wrapper).attributes('disabled')).toBeDefined();
    });

    test('JSON without an ABI shows the missing-ABI error', async () => {
      const { wrapper } = await mountForm({ contractId: '0.0.7777' });
      upload(wrapper, fileOf('{"foo":1}'));
      await flushPromises();
      expect(wrapper.text()).toContain('Could not find an ABI in this file');
    });

    test('a non-Error failure falls back to the default message', async () => {
      const spy = vi.spyOn(TextDecoder.prototype, 'decode').mockImplementation(() => {
        throw 'boom';  
      });
      const { wrapper } = await mountForm({ contractId: '0.0.7777' });
      upload(wrapper, fileOf('[]'));
      await flushPromises();
      spy.mockRestore();
      expect(wrapper.text()).toContain('Failed to parse ABI file');
    });

    test('an in-progress upload (<100%) neither parses nor emits', async () => {
      const { wrapper, emitted } = await mountForm({ contractId: '0.0.7777' });
      upload(wrapper, fileOf(JSON.stringify(ABI), 40));
      await flushPromises();
      expect(emitted).toHaveLength(0);
      expect(sel(wrapper).attributes('disabled')).toBeDefined();
    });

    test('removing the file clears the ABI and a previous error', async () => {
      const { wrapper } = await mountForm({ contractId: '0.0.7777' });
      upload(wrapper, fileOf('nope'));
      await flushPromises();
      expect(wrapper.text()).toContain('File is not valid JSON');
      upload(wrapper, null);
      await flushPromises();
      expect(wrapper.text()).not.toContain('File is not valid JSON');
    });
  });

  describe('gas', () => {
    test('emits numeric gas, and 0 for non-numeric input', async () => {
      const { wrapper, emitted } = await mountForm();
      const gas = wrapper.find('[data-testid="input-contract-execute-gas"]');
      expect(gas.exists()).toBe(true);
      const input = wrapper.findAllComponents({ name: 'AppInput' })[0];
      expect(input.props('modelValue')).toBe('100000');
      input.vm.$emit('update:modelValue', '250000');
      input.vm.$emit('update:modelValue', 'abc');
      await flushPromises();
      expect(emitted[0].gas).toBe(250000);
      expect(emitted[1].gas).toBe(0);
    });
  });

  describe('function selection', () => {
    test('selecting a function seeds blank args from its inputs', async () => {
      const { wrapper, emitted } = await mountForm({ contractId: '0.0.1001' });
      await chooseFunction(wrapper, 'mint');
      expect(emitted.at(-1)).toMatchObject({
        functionName: 'mint',
        rawFunctionParametersHex: '',
        functionArgs: [
          { name: 'to', type: 'address', value: '' },
          { name: 'amount', type: 'uint256', value: '' },
        ],
      });
    });

    test('selecting the placeholder clears args', async () => {
      const { wrapper, emitted } = await mountForm({ contractId: '0.0.1001' });
      await chooseFunction(wrapper, 'mint');
      await chooseFunction(wrapper, '');
      expect(emitted.at(-1)).toMatchObject({ functionName: '', functionArgs: [] });
    });

    test('payable amount input only appears for payable functions', async () => {
      const { wrapper } = await mountForm({ contractId: '0.0.1001' });
      const payable = () => wrapper.find('[data-testid="input-contract-execute-payable-amount"]');
      expect(payable().exists()).toBe(false);
      await chooseFunction(wrapper, 'mint');
      expect(payable().exists()).toBe(false);
      await chooseFunction(wrapper, 'deposit');
      expect(payable().exists()).toBe(true);
    });

    test('payable amount is kept when re-selecting a payable function, reset when moving to a non-payable one', async () => {
      const { wrapper, emitted } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'deposit',
        payableAmount: new Hbar(5),
      });
      await chooseFunction(wrapper, 'deposit');
      expect(emitted.at(-1)!.payableAmount.toBigNumber().toNumber()).toBe(5);
      await chooseFunction(wrapper, 'mint');
      expect(emitted.at(-1)!.payableAmount.toBigNumber().toNumber()).toBe(0);
    });

    test('editing the payable amount emits it', async () => {
      const { wrapper, emitted } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'deposit',
      });
      wrapper.findComponent({ name: 'AppHbarInput' }).vm.$emit('update:modelValue', new Hbar(3));
      await flushPromises();
      expect(emitted.at(-1)!.payableAmount.toBigNumber().toNumber()).toBe(3);
    });
  });

  describe('overloaded functions', () => {
    const OVERLOADED_ABI = [
      {
        type: 'function',
        name: 'transfer',
        inputs: [{ name: 'to', type: 'address' }],
        outputs: [],
        stateMutability: 'nonpayable',
      },
      {
        type: 'function',
        name: 'transfer',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [],
        stateMutability: 'payable',
      },
    ];

    beforeEach(() => {
      getAllMock.mockResolvedValue([
        makeContract({ abi: JSON.stringify(OVERLOADED_ABI) }),
      ]);
    });

    test('each overload gets its own option value (the signature), not a shared bare name', async () => {
      const { wrapper } = await mountForm({ contractId: '0.0.1001' });
      const values = sel(wrapper)
        .findAll('option')
        .map(o => o.attributes('value'));
      expect(values).toEqual(['', 'transfer(address)', 'transfer(address,uint256)']);
    });

    test('selecting the second overload seeds its own args, not the first overload\'s', async () => {
      const { wrapper, emitted } = await mountForm({ contractId: '0.0.1001' });
      await chooseFunction(wrapper, 'transfer(address,uint256)');
      expect(emitted.at(-1)).toMatchObject({
        functionName: 'transfer',
        functionArgs: [
          { name: 'to', type: 'address', value: '' },
          { name: 'amount', type: 'uint256', value: '' },
        ],
      });
    });

    test('switching from the second overload back to the first drops the extra arg', async () => {
      const { wrapper, emitted } = await mountForm({ contractId: '0.0.1001' });
      await chooseFunction(wrapper, 'transfer(address,uint256)');
      await chooseFunction(wrapper, 'transfer(address)');
      expect(emitted.at(-1)).toMatchObject({
        functionName: 'transfer',
        functionArgs: [{ name: 'to', type: 'address', value: '' }],
      });
    });

    test('payable amount input reflects the exact overload selected, not always the first', async () => {
      const { wrapper } = await mountForm({ contractId: '0.0.1001' });
      const payable = () => wrapper.find('[data-testid="input-contract-execute-payable-amount"]');
      await chooseFunction(wrapper, 'transfer(address)');
      expect(payable().exists()).toBe(false);
      await chooseFunction(wrapper, 'transfer(address,uint256)');
      expect(payable().exists()).toBe(true);
    });
  });

  describe('parameters', () => {
    const args = [
      { name: 'to', type: 'address', value: '' },
      { name: 'amount', type: 'uint256', value: '' },
    ];

    test('renders no parameter section without args', async () => {
      const { wrapper } = await mountForm({ contractId: '0.0.1001' });
      expect(wrapper.text()).not.toContain('Parameters');
    });

    test('renders text inputs and updates only the edited argument', async () => {
      const { wrapper, emitted } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'mint',
        functionArgs: args,
      });
      expect(wrapper.text()).toContain('Parameters');
      const inputs = wrapper.findAllComponents({ name: 'AppInput' }).slice(1);
      expect(inputs.map(i => i.props('placeholder'))).toEqual(['address', 'uint256']);
      inputs[1].vm.$emit('update:modelValue', '42');
      await flushPromises();
      expect(emitted.at(-1)!.functionArgs).toEqual([args[0], { ...args[1], value: '42' }]);
    });

    // AppInput's autoTrim strips trailing whitespace on every keystroke by default, which would
    // make it impossible to type a sentence with spaces into a string param (each space is
    // stripped the instant it's typed, since it's always the trailing character at that point).
    // Every other arg type is already charset-restricted by isAllowedFunctionArgKey /
    // sanitizeFunctionArgInput to exclude whitespace, so leaving autoTrim on for them is harmless.
    test('disables autoTrim only for string params, so sentences with spaces can be typed', async () => {
      const { wrapper } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'mint',
        functionArgs: args,
      });
      const inputs = wrapper.findAllComponents({ name: 'AppInput' }).slice(1);
      expect(inputs.map(i => i.props('autoTrim'))).toEqual([true, true]);

      getAllMock.mockResolvedValue([
        makeContract({
          abi: JSON.stringify([ABI[3]]),
        }),
      ]);
      const stringForm = await mountForm({
        contractId: '0.0.1001',
        functionName: 'setName',
        functionArgs: [{ name: 'n', type: 'string', value: '' }],
      });
      const stringInput = stringForm.wrapper.findAllComponents({ name: 'AppInput' }).slice(1)[0];
      expect(stringInput.props('autoTrim')).toBe(false);
    });

    test('bool params render a checkbox that emits true/false strings', async () => {
      const { wrapper, emitted } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'setFlag',
        functionArgs: [{ name: '', type: 'bool', value: 'true' }],
      });
      expect(wrapper.text()).toContain('param0');
      const box = wrapper.findComponent({ name: 'AppCheckBox' });
      expect(box.props('checked')).toBe(true);
      box.vm.$emit('update:checked', false);
      await flushPromises();
      expect(emitted.at(-1)!.functionArgs[0].value).toBe('false');
      wrapper.findComponent({ name: 'AppCheckBox' }).vm.$emit('update:checked', true);
      await flushPromises();
      expect(emitted.at(-1)!.functionArgs[0].value).toBe('true');
    });

    test('keydown blocks a letter in a uint field but allows a digit', async () => {
      const { wrapper } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'mint',
        functionArgs: args,
      });
      const el = wrapper.findAllComponents({ name: 'AppInput' }).slice(1)[1].element as HTMLInputElement;

      const letterEvent = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
      el.dispatchEvent(letterEvent);
      expect(letterEvent.defaultPrevented).toBe(true);

      const digitEvent = new KeyboardEvent('keydown', { key: '5', cancelable: true });
      el.dispatchEvent(digitEvent);
      expect(digitEvent.defaultPrevented).toBe(false);
    });

    test('shows no error for an untouched (empty) arg, but flags an invalid one once typed', async () => {
      const { wrapper } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'mint',
        functionArgs: args,
      });
      expect(wrapper.find('[data-testid="error-contract-execute-arg-0"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="error-contract-execute-arg-1"]').exists()).toBe(false);

      const inputs = wrapper.findAllComponents({ name: 'AppInput' }).slice(1);
      inputs[0].vm.$emit('update:modelValue', 'not-an-address');
      await flushPromises();

      expect(wrapper.find('[data-testid="error-contract-execute-arg-0"]').text()).toBe(
        'Must be a 40-character hex address (0x...)',
      );
    });

    test('clears the error once a valid value is entered', async () => {
      const { wrapper } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'mint',
        functionArgs: args,
      });
      const inputs = wrapper.findAllComponents({ name: 'AppInput' }).slice(1);
      // too short to be a valid address, but well-formed hex (survives sanitization)
      inputs[0].vm.$emit('update:modelValue', '0xabc');
      await flushPromises();
      expect(wrapper.find('[data-testid="error-contract-execute-arg-0"]').exists()).toBe(true);

      inputs[0].vm.$emit('update:modelValue', '0x' + 'ab'.repeat(20));
      await flushPromises();
      expect(wrapper.find('[data-testid="error-contract-execute-arg-0"]').exists()).toBe(false);
    });

    test('sanitizes keystrokes before validating (e.g. strips a stray minus from a uint field)', async () => {
      const { wrapper, emitted } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'mint',
        functionArgs: args,
      });
      const inputs = wrapper.findAllComponents({ name: 'AppInput' }).slice(1);
      inputs[1].vm.$emit('update:modelValue', '-1');
      await flushPromises();
      expect(emitted.at(-1)!.functionArgs[1].value).toBe('1');
      expect(wrapper.find('[data-testid="error-contract-execute-arg-1"]').exists()).toBe(false);
    });
  });

  describe('draft reload', () => {
    const calldata = () =>
      buildFunctionCallData('mint', [
        { name: 'to', type: 'address', value: '0x' + '12'.repeat(20) },
        { name: 'amount', type: 'uint256', value: '7' },
      ]);

    test('decodes raw calldata back into function selection once the ABI is known', async () => {
      const { emitted } = await mountForm({
        contractId: '0.0.1001',
        rawFunctionParametersHex: calldata(),
      });
      const last = emitted.at(-1)!;
      expect(last.functionName).toBe('mint');
      expect(last.rawFunctionParametersHex).toBe('');
      expect(last.functionArgs).toEqual([
        { name: 'to', type: 'address', value: '0x' + '12'.repeat(20) },
        { name: 'amount', type: 'uint256', value: '7' },
      ]);
    });

    test('does nothing while the ABI is not yet available', async () => {
      const { emitted } = await mountForm({
        contractId: '0.0.9999',
        rawFunctionParametersHex: calldata(),
      });
      expect(emitted).toHaveLength(0);
    });

    test('does nothing when a function is already selected', async () => {
      const { emitted } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'mint',
        rawFunctionParametersHex: calldata(),
      });
      expect(emitted).toHaveLength(0);
    });

    test('does nothing without raw calldata', async () => {
      const { emitted } = await mountForm({ contractId: '0.0.1001' });
      expect(emitted).toHaveLength(0);
    });

    test('decodes raw calldata with a string param too (head/tail decoding)', async () => {
      getAllMock.mockResolvedValue([
        makeContract({
          abi: JSON.stringify([
            {
              type: 'function',
              name: 'setName',
              inputs: [{ name: 'n', type: 'string' }],
              outputs: [],
              stateMutability: 'nonpayable',
            },
          ]),
        }),
      ]);
      const { ContractFunctionParameters } = await import('@hiero-ledger/sdk');
      const hex = Buffer.from(
        new ContractFunctionParameters().addString('hi')._build('setName'),
      ).toString('hex');
      const { emitted } = await mountForm({ contractId: '0.0.1001', rawFunctionParametersHex: hex });
      const last = emitted.at(-1)!;
      expect(last.functionName).toBe('setName');
      expect(last.functionArgs).toEqual([{ name: 'n', type: 'string', value: 'hi' }]);
    });

    test('does not emit when the selector matches nothing or args cannot be decoded (array param)', async () => {
      const unknown = await mountForm({
        contractId: '0.0.1001',
        rawFunctionParametersHex: '0xdeadbeef',
      });
      expect(unknown.emitted).toHaveLength(0);

      // array params are identified by selector but still not decodable - see isCallableAbiFunction
      getAllMock.mockResolvedValue([
        makeContract({
          abi: JSON.stringify([
            {
              type: 'function',
              name: 'setIds',
              inputs: [{ name: 'ids', type: 'uint256[]' }],
              outputs: [],
              stateMutability: 'nonpayable',
            },
          ]),
        }),
      ]);
      const { ContractFunctionParameters } = await import('@hiero-ledger/sdk');
      const hex = Buffer.from(
        new ContractFunctionParameters().addUint256Array([1, 2])._build('setIds'),
      ).toString('hex');
      const dynamic = await mountForm({ contractId: '0.0.1001', rawFunctionParametersHex: hex });
      expect(dynamic.emitted).toHaveLength(0);
    });
  });

  describe('call simulation', () => {
    const mintArgs = [
      { name: 'to', type: 'address', value: `0x${EVM}` },
      { name: 'amount', type: 'uint256', value: '5' },
    ];
    const simFail = (w: Wrapper) =>
      w.find('[data-testid="alert-contract-execute-simulation-fail"]');

    test('simulates the exact call with gas, value, and the fee payer evm address', async () => {
      simulateContractCallMock.mockResolvedValue({ status: 'pass' });
      const { wrapper } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'mint',
        functionArgs: mintArgs,
        gas: 150000,
      });
      expect(simulateContractCallMock).toHaveBeenCalledWith(
        { evmAddress: `0x${'00'.repeat(16)}${(1001).toString(16).padStart(8, '0')}` },
        'mint',
        mintArgs,
        {
          gas: 150000,
          valueTinybars: 0,
          from: `0x${AccountId.fromString(PAYER).toEvmAddress()}`,
        },
        'https://mirror.test',
      );
      expect(wrapper.text()).toContain('Simulated call currently succeeds.');
    });

    test('shows the warning alert with the mirror node error message on revert', async () => {
      simulateContractCallMock.mockResolvedValue({ status: 'fail', errorMessage: 'CONTRACT_REVERT_EXECUTED' });
      const { wrapper } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'mint',
        functionArgs: mintArgs,
      });
      expect(simFail(wrapper).exists()).toBe(true);
      expect(simFail(wrapper).text()).toContain('This call would currently fail.');
      expect(simFail(wrapper).text()).toContain('CONTRACT_REVERT_EXECUTED');
    });

    test('shows a checking indicator while the simulation is pending', async () => {
      let resolve!: (v: { status: string }) => void;
      simulateContractCallMock.mockReturnValue(new Promise(r => (resolve = r)));
      const { wrapper } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'mint',
        functionArgs: mintArgs,
      });
      expect(wrapper.text()).toContain('Simulating call...');
      resolve({ status: 'pass' });
      await flushPromises();
      expect(wrapper.text()).not.toContain('Simulating call...');
      expect(wrapper.text()).toContain('currently succeeds');
    });

    test.each([
      ['no function selected', { contractId: '0.0.1001' }, PAYER],
      [
        'malformed arg value',
        {
          contractId: '0.0.1001',
          functionName: 'mint',
          functionArgs: [mintArgs[0], { name: 'amount', type: 'uint256', value: 'not-a-number' }],
        },
        PAYER,
      ],
      [
        'invalid payer id',
        { contractId: '0.0.1001', functionName: 'mint', functionArgs: mintArgs },
        'not-an-id',
      ],
    ])('does not call the network for %s', async (_n, data, payer) => {
      const { wrapper } = await mountForm(data, payer);
      expect(simulateContractCallMock).not.toHaveBeenCalled();
      expect(simFail(wrapper).exists()).toBe(false);
    });

    test('does not call the network when the contract address cannot be resolved', async () => {
      await mountForm({ contractId: 'not-a-contract', functionName: 'mint', functionArgs: mintArgs });
      expect(simulateContractCallMock).not.toHaveBeenCalled();
    });

    test('re-simulates when the payer changes', async () => {
      simulateContractCallMock.mockResolvedValue({ status: 'pass' });
      const { wrapper } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'mint',
        functionArgs: mintArgs,
      });
      await wrapper.setProps({ payerId: '0.0.700' });
      await flushPromises();
      expect(simulateContractCallMock).toHaveBeenCalledTimes(2);
    });

    test('a stale response for previous inputs does not overwrite a newer one', async () => {
      let resolveStale!: (v: { status: string; errorMessage?: string }) => void;
      simulateContractCallMock
        .mockImplementationOnce(() => new Promise(r => (resolveStale = r)))
        .mockResolvedValueOnce({ status: 'pass' });

      const { wrapper } = await mountForm({
        contractId: '0.0.1001',
        functionName: 'mint',
        functionArgs: mintArgs,
      });
      await wrapper.setProps({ payerId: '0.0.700' });
      await flushPromises();
      expect(wrapper.text()).toContain('Simulated call currently succeeds.'); // the newer check already resolved 'pass'

      resolveStale({ status: 'fail', errorMessage: 'STALE - should never be shown' });
      await flushPromises();
      expect(wrapper.text()).toContain('Simulated call currently succeeds.'); // still 'pass', not the stale 'fail'
      expect(wrapper.text()).not.toContain('STALE');
    });

    test('includes a non-zero payable amount in tinybars', async () => {
      simulateContractCallMock.mockResolvedValue({ status: 'pass' });
      await mountForm({
        contractId: '0.0.1001',
        functionName: 'deposit',
        payableAmount: new Hbar(2),
      });
      expect(simulateContractCallMock).toHaveBeenCalledWith(
        expect.anything(),
        'deposit',
        [],
        expect.objectContaining({ valueTinybars: 200_000_000 }),
        'https://mirror.test',
      );
    });
  });
});
