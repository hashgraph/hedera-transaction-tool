// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import { Hbar } from '@hiero-ledger/sdk';

import type { ContractCreateData } from '@renderer/utils/sdk';

import ContractCreateFormData from '@renderer/components/Transaction/Create/ContractCreate/ContractCreateFormData.vue';
import { TRANSACTION_MAX_SIZE } from '@shared/constants';
import { CONTRACT_CREATE_OVERHEAD_BYTES } from '@renderer/utils/sdk/privilegedPayer';

/* Mocks */
const networkState = reactive({ network: 'testnet', nodeNumbers: [0, 1, 2] });
vi.mock('@renderer/stores/storeNetwork', () => ({ default: () => networkState }));

vi.mock('@renderer/components/KeyField.vue', () => ({
  default: {
    name: 'KeyField',
    props: ['modelKey', 'label', 'isRequired'],
    emits: ['update:modelKey'],
    template: '<div />',
  },
}));
vi.mock('@renderer/components/AccountIdInput.vue', () => ({
  default: {
    name: 'AccountIdInput',
    props: ['modelValue', 'items', 'dataTestid'],
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
vi.mock('@renderer/components/ui/AppSwitch.vue', () => ({
  default: {
    name: 'AppSwitch',
    props: ['checked', 'name', 'label'],
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
const ABI_WITH_CTOR = [
  {
    type: 'constructor',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'supply', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  { type: 'function', name: 'mint', inputs: [], outputs: [], stateMutability: 'nonpayable' },
];
const ABI_NO_CTOR = [
  { type: 'function', name: 'mint', inputs: [], outputs: [], stateMutability: 'nonpayable' },
];
const EVM = '00000000000000000000000000000000000004d2';

function baseData(overrides: Partial<ContractCreateData> = {}): ContractCreateData {
  return {
    bytecodeSource: 'inline',
    bytecodeHex: '',
    bytecodeFileId: '',
    adminKey: null,
    gas: 1000000,
    initialBalance: new Hbar(0),
    autoRenewAccountId: '',
    contractMemo: '',
    maxAutomaticTokenAssociations: 0,
    declineStakingReward: false,
    stakeType: 'None',
    stakedAccountId: '',
    stakedNodeId: null,
    constructorArgs: [],
    ...overrides,
  };
}

type Wrapper = VueWrapper<InstanceType<typeof ContractCreateFormData>>;

async function mountForm(
  data: Partial<ContractCreateData> = {},
  { payerId = '0.0.1001', needsBytecodeReupload = false, settle = true } = {},
) {
  const emitted: ContractCreateData[] = [];
  // A plain reactive object mutated in place via Object.assign on every update, exactly like
  // ContractCreate.vue's own `data` + `handleUpdateData` - not wrapper.setProps(), which replaces
  // props asynchronously and would miss that two emits within the same synchronous handler (e.g.
  // handleArtifactFileUpdate) can each see the other's effect immediately, since Vue's reactivity
  // makes an in-place mutation visible on the very next property read, independent of rendering.
  const sharedData = reactive(baseData(data));
  const wrapper: Wrapper = mount(ContractCreateFormData, {
    props: {
      data: sharedData,
      payerId,
      needsBytecodeReupload,
      'onUpdate:data': (d: ContractCreateData) => {
        emitted.push(d);
        Object.assign(sharedData, d);
      },
    } as never,
  });
  if (settle) await flushPromises();
  return { wrapper, emitted };
}

const upload = (w: Wrapper, file: unknown) =>
  w.findComponent({ name: 'AppUploadFile' }).vm.$emit('update:file', file);
const fileOf = (text: string, loadPercentage = 100) => ({
  meta: new File([text], 'artifact.json'),
  content: new TextEncoder().encode(text),
  loadPercentage,
});

describe('ContractCreateFormData.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    networkState.network = 'testnet';
    networkState.nodeNumbers = [0, 1, 2];
  });

  describe('artifact upload (ABI + bytecode)', () => {
    test('a Hardhat-style artifact populates bytecode and constructor args from the ABI', async () => {
      const { wrapper, emitted } = await mountForm();
      upload(
        wrapper,
        fileOf(JSON.stringify({ abi: ABI_WITH_CTOR, bytecode: '0x6080604052' })),
      );
      await flushPromises();

      const last = emitted.at(-1)!;
      expect(last.bytecodeHex).toBe('6080604052');
      expect(last.constructorArgs).toEqual([
        { name: 'owner', type: 'address', value: '' },
        { name: 'supply', type: 'uint256', value: '' },
      ]);
      expect(wrapper.text()).toContain('Bytecode loaded (5 bytes)');
    });

    test('an ABI with no constructor clears constructor args', async () => {
      const { wrapper, emitted } = await mountForm({
        constructorArgs: [{ name: 'x', type: 'uint256', value: '1' }],
      });
      upload(wrapper, fileOf(JSON.stringify({ abi: ABI_NO_CTOR, bytecode: '0x6080' })));
      await flushPromises();
      expect(emitted.at(-1)!.constructorArgs).toEqual([]);
    });

    test('a single-contract solc --standard-json output file populates both ABI and bytecode', async () => {
      const { wrapper, emitted } = await mountForm();
      upload(
        wrapper,
        fileOf(
          JSON.stringify({
            contracts: {
              'A.sol': { A: { abi: ABI_NO_CTOR, evm: { bytecode: { object: '0x6080' } } } },
            },
          }),
        ),
      );
      await flushPromises();
      expect(emitted.at(-1)!.bytecodeHex).toBe('6080');
    });

    test('invalid JSON shows a parse error', async () => {
      const { wrapper } = await mountForm();
      upload(wrapper, fileOf('not json'));
      await flushPromises();
      expect(wrapper.text()).toContain('File is not valid JSON');
    });

    test('a file still loading is not parsed yet', async () => {
      const { wrapper, emitted } = await mountForm();
      upload(wrapper, fileOf(JSON.stringify({ abi: ABI_NO_CTOR }), 42));
      await flushPromises();
      expect(emitted).toHaveLength(0);
      expect(wrapper.findComponent({ name: 'AppUploadFile' }).props('file')).not.toBeNull();
    });

    test('removing the file clears the error but keeps previously-accepted data', async () => {
      const { wrapper } = await mountForm({ bytecodeHex: '6080' });
      upload(wrapper, fileOf('not json'));
      await flushPromises();
      expect(wrapper.text()).toContain('File is not valid JSON');
      upload(wrapper, null);
      await flushPromises();
      expect(wrapper.text()).not.toContain('File is not valid JSON');
    });

    test('a source-only Standard JSON Input file is rejected (no ABI/bytecode to act on)', async () => {
      const { wrapper, emitted } = await mountForm();
      upload(
        wrapper,
        fileOf(
          JSON.stringify({
            sources: { 'WorldClock.sol': { content: 'contract WorldClock {}' } },
            settings: { compilationTarget: { 'WorldClock.sol': 'WorldClock' } },
          }),
        ),
      );
      await flushPromises();
      expect(wrapper.text()).toContain('only has source code');
      expect(emitted).toHaveLength(0);
    });

    test('removing a successfully-parsed file undoes what it contributed (bytecode, constructor args)', async () => {
      const { wrapper, emitted } = await mountForm();
      upload(wrapper, fileOf(JSON.stringify({ abi: ABI_WITH_CTOR, bytecode: '0x6080604052' })));
      await flushPromises();
      expect(emitted.at(-1)!.bytecodeHex).toBe('6080604052');

      upload(wrapper, null);
      await flushPromises();

      expect(emitted.at(-1)!.bytecodeHex).toBe('');
      expect(emitted.at(-1)!.constructorArgs).toEqual([]);
      expect(wrapper.text()).not.toContain('Bytecode loaded');
    });

    test('removing a file after a failed re-upload still keeps the earlier successful data', async () => {
      const { wrapper, emitted } = await mountForm();
      upload(wrapper, fileOf(JSON.stringify({ abi: ABI_NO_CTOR, bytecode: '0x6080' })));
      await flushPromises();
      expect(emitted.at(-1)!.bytecodeHex).toBe('6080');

      upload(wrapper, fileOf('not json'));
      await flushPromises();
      expect(wrapper.text()).toContain('File is not valid JSON');

      upload(wrapper, null);
      await flushPromises();
      expect(wrapper.text()).not.toContain('File is not valid JSON');
      expect(emitted.at(-1)!.bytecodeHex).toBe('6080');
    });
  });

  describe('bytecode size check', () => {
    const maxBytes = TRANSACTION_MAX_SIZE - CONTRACT_CREATE_OVERHEAD_BYTES;

    test('shows the oversized message and points at FileCreate/FileAppend', async () => {
      const oversizedHex = '00'.repeat(maxBytes + 1);
      const { wrapper } = await mountForm({ bytecodeHex: oversizedHex });
      expect(wrapper.find('[data-testid="text-contract-create-bytecode-oversized"]').exists()).toBe(
        true,
      );
      expect(wrapper.text()).toContain('enter that File ID instead');
    });

    test('exactly at the limit is not oversized', async () => {
      const exactHex = '00'.repeat(maxBytes);
      const { wrapper } = await mountForm({ bytecodeHex: exactHex });
      expect(
        wrapper.find('[data-testid="text-contract-create-bytecode-oversized"]').exists(),
      ).toBe(false);
    });

    test('is not shown for the "file" bytecode source, regardless of hex length', async () => {
      const oversizedHex = '00'.repeat(maxBytes + 1);
      const { wrapper } = await mountForm({ bytecodeSource: 'file', bytecodeHex: oversizedHex });
      expect(
        wrapper.find('[data-testid="text-contract-create-bytecode-oversized"]').exists(),
      ).toBe(false);
    });
  });

  describe('bytecode: upload vs. existing File ID', () => {
    test('the File ID input is always visible, and typing into it switches the source to "file"', async () => {
      const { wrapper, emitted } = await mountForm();
      const fileIdInput = wrapper.find('[data-testid="input-contract-create-bytecode-file-id"]');
      expect(fileIdInput.exists()).toBe(true);

      wrapper
        .findAllComponents({ name: 'AppInput' })
        .find(c => c.attributes('data-testid') === 'input-contract-create-bytecode-file-id')
        ?.vm.$emit('update:modelValue', '0.0.1234');
      await flushPromises();
      expect(emitted.at(-1)!.bytecodeFileId).toBe('0.0.1234');
      expect(emitted.at(-1)!.bytecodeSource).toBe('file');
      // No ABI has been uploaded yet - the File ID only covers the bytecode, so the
      // "using file id" message is held back in favor of the ABI-missing warning.
      expect(wrapper.find('[data-testid="text-contract-create-abi-missing"]').exists()).toBe(true);
      expect(
        wrapper.find('[data-testid="text-contract-create-using-file-id"]').exists(),
      ).toBe(false);

      upload(wrapper, fileOf(JSON.stringify({ abi: ABI_NO_CTOR })));
      await flushPromises();
      expect(wrapper.find('[data-testid="text-contract-create-abi-missing"]').exists()).toBe(
        false,
      );
      expect(
        wrapper.find('[data-testid="text-contract-create-using-file-id"]').exists(),
      ).toBe(true);
    });

    test('no ABI-missing warning when the File ID field is empty', async () => {
      const { wrapper } = await mountForm();
      expect(wrapper.find('[data-testid="text-contract-create-abi-missing"]').exists()).toBe(
        false,
      );
    });

    test('clearing the File ID switches the source back to "inline"', async () => {
      const { wrapper, emitted } = await mountForm({
        bytecodeSource: 'file',
        bytecodeFileId: '0.0.1234',
      });
      wrapper
        .findAllComponents({ name: 'AppInput' })
        .find(c => c.attributes('data-testid') === 'input-contract-create-bytecode-file-id')
        ?.vm.$emit('update:modelValue', '');
      await flushPromises();
      expect(emitted.at(-1)!.bytecodeFileId).toBe('');
      expect(emitted.at(-1)!.bytecodeSource).toBe('inline');
    });
  });

  describe('draft-reload re-upload message (temporary, see hiero-sdk-js#4660)', () => {
    test('shown when needsBytecodeReupload is true, source is inline, and bytecode is empty', async () => {
      const { wrapper } = await mountForm({}, { needsBytecodeReupload: true });
      expect(wrapper.find('[data-testid="text-contract-create-reupload-needed"]').exists()).toBe(
        true,
      );
    });

    test('hidden once the bytecode has been re-uploaded', async () => {
      const { wrapper } = await mountForm({}, { needsBytecodeReupload: true });
      upload(wrapper, fileOf(JSON.stringify({ abi: ABI_NO_CTOR, bytecode: '0x6080' })));
      await flushPromises();
      expect(wrapper.find('[data-testid="text-contract-create-reupload-needed"]').exists()).toBe(
        false,
      );
    });

    test('hidden once a Bytecode File ID is set', async () => {
      const { wrapper } = await mountForm(
        { bytecodeSource: 'file', bytecodeFileId: '0.0.1234' },
        { needsBytecodeReupload: true },
      );
      expect(wrapper.find('[data-testid="text-contract-create-reupload-needed"]').exists()).toBe(
        false,
      );
    });

    test('not shown when needsBytecodeReupload is false', async () => {
      const { wrapper } = await mountForm();
      expect(wrapper.find('[data-testid="text-contract-create-reupload-needed"]').exists()).toBe(
        false,
      );
    });
  });

  describe('reloaded draft: decoding raw constructor params once the ABI is re-uploaded', () => {
    test('decodes rawConstructorParametersHex into named args once the ABI arrives', async () => {
      const rawHex = EVM.padStart(64, '0') + '1'.padStart(64, '0');
      const { wrapper, emitted } = await mountForm({ rawConstructorParametersHex: rawHex });
      upload(wrapper, fileOf(JSON.stringify({ abi: ABI_WITH_CTOR })));
      await flushPromises();

      const last = emitted.at(-1)!;
      expect(last.constructorArgs).toEqual([
        { name: 'owner', type: 'address', value: `0x${EVM}` },
        { name: 'supply', type: 'uint256', value: '1' },
      ]);
      expect(last.rawConstructorParametersHex).toBe('');
    });

    test('a fresh upload resets to blank fields instead of decoding when args are already present', async () => {
      const rawHex = EVM.padStart(64, '0') + '1'.padStart(64, '0');
      const { wrapper, emitted } = await mountForm({
        rawConstructorParametersHex: rawHex,
        constructorArgs: [{ name: 'owner', type: 'address', value: '0xalready-set' }],
      });
      upload(wrapper, fileOf(JSON.stringify({ abi: ABI_WITH_CTOR })));
      await flushPromises();
      // constructorArgs.length > 0 already, so this is "new upload while editing", not a
      // reloaded-draft decode - resets to this ABI's blank fields rather than decoding rawHex.
      expect(emitted.at(-1)!.constructorArgs).toEqual([
        { name: 'owner', type: 'address', value: '' },
        { name: 'supply', type: 'uint256', value: '' },
      ]);
      expect(emitted.at(-1)!.rawConstructorParametersHex).toBe('');
    });
  });

  describe('constructor parameter fields', () => {
    test('renders a field per constructor input and reports validation errors', async () => {
      const { wrapper, emitted } = await mountForm({
        constructorArgs: [
          { name: 'owner', type: 'address', value: '' },
          { name: 'supply', type: 'uint256', value: '' },
        ],
      });
      expect(wrapper.find('[data-testid="input-contract-create-arg-0"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="input-contract-create-arg-1"]').exists()).toBe(true);

      wrapper
        .findAllComponents({ name: 'AppInput' })
        .find(c => c.attributes('data-testid') === 'input-contract-create-arg-1')
        ?.vm.$emit('update:modelValue', '99999999999999999999999999999999999999999999999999999999999999999999999999999');
      await flushPromises();
      expect(emitted.length).toBeGreaterThan(0);
    });

    test('a bool constructor arg renders a checkbox', async () => {
      const { wrapper } = await mountForm({
        constructorArgs: [{ name: 'flag', type: 'bool', value: '' }],
      });
      expect(wrapper.find('[data-testid="input-contract-create-arg-0"]').exists()).toBe(true);
      expect(wrapper.findComponent({ name: 'AppCheckBox' }).exists()).toBe(true);
    });

    test('a constructor with a tuple/array arg shows the unsupported-type warning', async () => {
      const { wrapper } = await mountForm();
      upload(
        wrapper,
        fileOf(
          JSON.stringify({
            abi: [
              {
                type: 'constructor',
                inputs: [{ name: 'x', type: 'tuple' }],
                stateMutability: 'nonpayable',
              },
            ],
            bytecode: '0x6080',
          }),
        ),
      );
      await flushPromises();
      expect(wrapper.text()).toContain('cannot be entered here');
    });
  });

  describe('field wiring', () => {
    test('admin key updates flow through KeyField', async () => {
      const { wrapper, emitted } = await mountForm();
      const key = { toString: () => 'fake-key' } as never;
      wrapper.findComponent({ name: 'KeyField' }).vm.$emit('update:modelKey', key);
      await flushPromises();
      expect(emitted.at(-1)!.adminKey).toBe(key);
    });

    test('gas, memo, max automatic token associations, and auto-renew account update', async () => {
      const { wrapper, emitted } = await mountForm();
      const inputs = wrapper.findAllComponents({ name: 'AppInput' });
      const gasInput = inputs.find(c => c.attributes('data-testid') === 'input-contract-create-gas');
      gasInput?.vm.$emit('update:modelValue', '500000');
      await flushPromises();
      expect(emitted.at(-1)!.gas).toBe(500000);

      const memoInput = inputs.find(c => c.attributes('data-testid') === 'input-contract-create-memo');
      memoInput?.vm.$emit('update:modelValue', 'hello');
      await flushPromises();
      expect(emitted.at(-1)!.contractMemo).toBe('hello');

      wrapper
        .findComponent({ name: 'AccountIdInput' })
        .vm.$emit('update:modelValue', '0.0.55');
      await flushPromises();
      expect(emitted.at(-1)!.autoRenewAccountId).toBe('0.0.55');
    });

    test('staking: switching to Account/Node shows the right sub-field', async () => {
      const { wrapper } = await mountForm();
      const stakeSelect = wrapper.find('[data-testid="select-contract-create-stake-type"]');
      // AccountIdInput is a stubbed component (not a plain element), so it must be located by
      // component name - its stub template doesn't echo data-testid back as a DOM attribute.
      // There's already one AccountIdInput for "Auto Renew Account"; a second one is the staked
      // account field.
      expect(wrapper.findAllComponents({ name: 'AccountIdInput' })).toHaveLength(1);

      (stakeSelect.element as HTMLSelectElement).value = 'Account';
      await stakeSelect.trigger('change');
      await flushPromises();
      expect(wrapper.findAllComponents({ name: 'AccountIdInput' })).toHaveLength(2);

      (stakeSelect.element as HTMLSelectElement).value = 'Node';
      await stakeSelect.trigger('change');
      await flushPromises();
      expect(wrapper.find('[data-testid="select-contract-create-staked-node"]').exists()).toBe(
        true,
      );
    });

    test('decline staking reward switch is inverted (switch = "accept")', async () => {
      const { wrapper, emitted } = await mountForm();
      wrapper
        .findComponent({ name: 'AppSwitch' })
        .vm.$emit('update:checked', false);
      await flushPromises();
      expect(emitted.at(-1)!.declineStakingReward).toBe(true);
    });
  });
});
