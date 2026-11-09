// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';

import AddSmartContract from '@renderer/pages/SmartContracts/AddSmartContract/AddSmartContract.vue';
import { ToastManager } from '@renderer/utils/ToastManager';

// The network store is shared reactive state, so wrappers left mounted would react to later changes.
enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({
  userStore: { personal: { isLoggedIn: true, id: 'local-user' } as any },
  networkStore: {
    network: 'testnet',
    mirrorNodeBaseURL: 'https://mirror.example',
  },
  router: { push: vi.fn(), back: vi.fn() },
  add: vi.fn(),
  getContractInfo: vi.fn(),
  getVerifiedContract: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('vue-router', () => ({ useRouter: vi.fn(() => mocks.router) }));
vi.mock('@renderer/stores/storeUser', () => ({ default: vi.fn(() => mocks.userStore) }));
vi.mock('@renderer/stores/storeNetwork', () => {
  mocks.networkStore = reactive(mocks.networkStore);
  return { default: vi.fn(() => mocks.networkStore) };
});
vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));
vi.mock('@renderer/services/smartContractsService', () => ({ add: mocks.add }));
vi.mock('@renderer/services/mirrorNodeDataService', () => ({
  getContractInfo: mocks.getContractInfo,
}));
vi.mock('@renderer/services/sourcifyService', () => ({
  getVerifiedContract: mocks.getVerifiedContract,
}));

const AppButtonStub = {
  props: ['disabled'],
  template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
};
const AppUploadFileStub = {
  props: ['file'],
  emits: ['update:file'],
  template: '<div data-testid="upload-stub" />',
};
const SourceViewerStub = {
  props: ['contractName', 'sources'],
  template: '<div data-testid="source-viewer">{{ contractName }}|{{ sources.length }}</div>',
};

const CONTRACT_ID = '0.0.1234';
const EVM = '0x' + 'ab'.repeat(20);
const fnAbi = (name: string) => ({
  type: 'function',
  name,
  inputs: [],
  outputs: [],
  stateMutability: 'view',
});
const info = { contract_id: CONTRACT_ID, evm_address: EVM, deleted: false };
const verifiedResult = (over = {}) => ({
  name: 'Token',
  match: 'exact_match',
  abi: [fnAbi('a'), fnAbi('b')],
  sources: [{ path: 'Token.sol', content: 'x' }],
  ...over,
});
const fileOf = (text: string, loadPercentage = 100) => ({
  meta: new File([text], 'abi.json'),
  content: new TextEncoder().encode(text),
  loadPercentage,
});

function mountPage() {
  return mount(AddSmartContract, {
    global: {
      stubs: {
        AppButton: AppButtonStub,
        AppUploadFile: AppUploadFileStub,
        ContractSourceViewer: SourceViewerStub,
      },
      mocks: { $router: mocks.router },
      provide: { [ToastManager.injectKey as symbol]: mocks.toast },
    },
  });
}
type Wrapper = ReturnType<typeof mountPage>;

const typeIdentifier = async (wrapper: Wrapper, value: string) => {
  await wrapper.find('[data-testid="input-smart-contract-identifier"]').setValue(value);
};
const settle = async () => {
  await vi.advanceTimersByTimeAsync(400);
  await flushPromises();
};
const lookup = async (wrapper: Wrapper, value = CONTRACT_ID) => {
  await typeIdentifier(wrapper, value);
  await settle();
};
const saveBtn = (wrapper: Wrapper) => wrapper.find('[data-testid="button-save-smart-contract"]');
const uploadFile = async (wrapper: Wrapper, file: unknown) => {
  wrapper.findComponent(AppUploadFileStub).vm.$emit('update:file', file);
  await flushPromises();
};

describe('AddSmartContract.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.userStore.personal = { isLoggedIn: true, id: 'local-user' };
    mocks.networkStore.network = 'testnet';
    mocks.networkStore.mirrorNodeBaseURL = 'https://mirror.example';
    mocks.getContractInfo.mockResolvedValue(info);
    mocks.getVerifiedContract.mockResolvedValue(null);
    mocks.add.mockResolvedValue({});
    mocks.router.push.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('initial state: hint text, upload shown, save disabled, no lookup', () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain('Enter a Contract ID (e.g. 0.0.1234)');
    expect(wrapper.find('[data-testid="upload-stub"]').exists()).toBe(true);
    expect(saveBtn(wrapper).attributes('disabled')).toBeDefined();
    expect(mocks.getContractInfo).not.toHaveBeenCalled();
  });

  test('back button navigates back', async () => {
    const wrapper = mountPage();
    await wrapper.find('button').trigger('click');
    expect(mocks.router.back).toHaveBeenCalled();
  });

  test('an invalid identifier shows a validation error and never triggers a lookup', async () => {
    const wrapper = mountPage();
    await lookup(wrapper, '0.0');
    expect(wrapper.text()).toContain('Enter a valid Contract ID (0.0.1234) or EVM address');
    expect(mocks.getContractInfo).not.toHaveBeenCalled();
    expect(saveBtn(wrapper).attributes('disabled')).toBeDefined();
  });

  test('shows a loading state while looking up, debounced', async () => {
    const wrapper = mountPage();
    await typeIdentifier(wrapper, CONTRACT_ID);
    expect(wrapper.text()).toContain('Looking up contract');
    expect(mocks.getContractInfo).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="upload-stub"]').exists()).toBe(false);
    expect(saveBtn(wrapper).attributes('disabled')).toBeDefined();

    await settle();
    expect(mocks.getContractInfo).toHaveBeenCalledWith(
      CONTRACT_ID,
      'https://mirror.example',
      expect.any(AbortController),
    );
  });

  test('a contract id resolves to its EVM address; unverified contracts ask for an ABI upload', async () => {
    const wrapper = mountPage();
    await lookup(wrapper);

    expect(mocks.getVerifiedContract).toHaveBeenCalledWith('testnet', EVM, expect.any(AbortController));
    expect(wrapper.text()).toContain(`EVM address: ${EVM}`);
    expect(wrapper.text()).toContain('This contract is not verified.');
    expect(wrapper.find('[data-testid="upload-stub"]').exists()).toBe(true);
    expect(saveBtn(wrapper).attributes('disabled')).toBeDefined();
  });

  test('an EVM address identifier resolves to its contract id and flags deleted contracts', async () => {
    mocks.getContractInfo.mockResolvedValue({ ...info, deleted: true });
    const wrapper = mountPage();
    await lookup(wrapper, `  ${EVM}  `);

    expect(mocks.getContractInfo).toHaveBeenCalledWith(EVM, expect.any(String), expect.anything());
    expect(wrapper.text()).toContain(`Contract ID: ${CONTRACT_ID}`);
    expect(wrapper.text()).toContain('(this contract is deleted)');
  });

  test('contract not found: shows the network, disables save even with an uploaded ABI', async () => {
    mocks.getContractInfo.mockResolvedValue(null);
    const wrapper = mountPage();
    await lookup(wrapper);

    expect(wrapper.text()).toContain('Contract not found on testnet.');
    expect(mocks.getVerifiedContract).not.toHaveBeenCalled();

    await uploadFile(wrapper, fileOf('[]'));
    expect(saveBtn(wrapper).attributes('disabled')).toBeDefined();
  });

  test('lookup error: warns but allows adding via uploaded ABI, storing what was typed', async () => {
    mocks.getContractInfo.mockRejectedValue(new Error('offline'));
    const wrapper = mountPage();
    await lookup(wrapper);

    expect(wrapper.text()).toContain('Could not look up this contract on the mirror node');
    await uploadFile(wrapper, fileOf(JSON.stringify([fnAbi('x')])));
    expect(saveBtn(wrapper).attributes('disabled')).toBeUndefined();

    await wrapper.find('[placeholder="Enter nickname"]').setValue('Mine');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.add).toHaveBeenCalledWith({
      user_id: 'local-user',
      network: 'testnet',
      contract_id: CONTRACT_ID,
      evm_address: null,
      nickname: 'Mine',
      abi: JSON.stringify([fnAbi('x')]),
      verified: false,
    });
  });

  test('lookup error with an EVM identifier stores the typed address', async () => {
    mocks.getContractInfo.mockRejectedValue(new Error('offline'));
    const wrapper = mountPage();
    await lookup(wrapper, EVM);
    await uploadFile(wrapper, fileOf('[]'));
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.add).toHaveBeenCalledWith(
      expect.objectContaining({ contract_id: null, evm_address: EVM }),
    );
  });

  test('verified on Sourcify: shows exact match, function count, source viewer, hides upload', async () => {
    mocks.getVerifiedContract.mockResolvedValue(verifiedResult());
    const wrapper = mountPage();
    await lookup(wrapper);

    const text = wrapper.find('[data-testid="text-contract-verified"]').text();
    expect(text).toContain('Verified on Sourcify (exact match)');
    expect(text).toContain('Found 2 functions.');
    expect(wrapper.find('[data-testid="upload-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-viewer"]').text()).toBe('Token|1');
    expect(wrapper.text()).toContain('Token source code');
    expect(saveBtn(wrapper).attributes('disabled')).toBeUndefined();
  });

  test('partial match and a single function use the singular wording; unnamed contract falls back', async () => {
    mocks.getVerifiedContract.mockResolvedValue(
      verifiedResult({ match: 'match', name: '', abi: [fnAbi('only')] }),
    );
    const wrapper = mountPage();
    await lookup(wrapper);

    const text = wrapper.find('[data-testid="text-contract-verified"]').text();
    expect(text).toContain('Verified on Sourcify (match)');
    expect(text).toContain('Found 1 function.');
    expect(wrapper.text()).toContain('Contract source code');
  });

  test('verified contract without sources shows no source viewer', async () => {
    mocks.getVerifiedContract.mockResolvedValue(verifiedResult({ sources: [] }));
    const wrapper = mountPage();
    await lookup(wrapper);
    expect(wrapper.find('[data-testid="source-viewer"]').exists()).toBe(false);
  });

  test('shows the checking message while Sourcify is being queried', async () => {
    let release!: (v: unknown) => void;
    mocks.getVerifiedContract.mockReturnValue(new Promise(r => (release = r)));
    const wrapper = mountPage();
    await lookup(wrapper);

    expect(wrapper.text()).toContain('Checking for verified source');
    expect(wrapper.find('[data-testid="upload-stub"]').exists()).toBe(false);
    expect(saveBtn(wrapper).attributes('disabled')).toBeDefined();

    release(verifiedResult());
    await flushPromises();
    expect(wrapper.find('[data-testid="text-contract-verified"]').exists()).toBe(true);
  });

  test('saving a verified contract stores both ids from the mirror node, marks verified, and navigates', async () => {
    mocks.getVerifiedContract.mockResolvedValue(verifiedResult());
    const wrapper = mountPage();
    await lookup(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.add).toHaveBeenCalledWith({
      user_id: 'local-user',
      network: 'testnet',
      contract_id: CONTRACT_ID,
      evm_address: EVM,
      nickname: '',
      abi: JSON.stringify(verifiedResult().abi),
      verified: true,
    });
    expect(mocks.toast.success).toHaveBeenCalledWith('Smart contract saved!');
    expect(mocks.router.push).toHaveBeenCalledWith({ name: 'smartContracts' });
  });

  test('submitting while the form is not saveable does nothing', async () => {
    const wrapper = mountPage();
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(mocks.add).not.toHaveBeenCalled();
  });

  test('save failure shows the error and stays on the page', async () => {
    mocks.getVerifiedContract.mockResolvedValue(verifiedResult());
    mocks.add.mockRejectedValue(new Error('db locked'));
    const wrapper = mountPage();
    await lookup(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.toast.error).toHaveBeenCalledWith('db locked');
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  test('save while logged out reports an error and does not add', async () => {
    mocks.getVerifiedContract.mockResolvedValue(verifiedResult());
    const wrapper = mountPage();
    await lookup(wrapper);
    mocks.userStore.personal = null;
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.add).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith('User not logged in');
  });

  describe('ABI upload', () => {
    const readyForUpload = async () => {
      const wrapper = mountPage();
      await lookup(wrapper);
      return wrapper;
    };

    test('a valid raw ABI array is accepted and reports its function count', async () => {
      const wrapper = await readyForUpload();
      await uploadFile(wrapper, fileOf(JSON.stringify([fnAbi('a'), { type: 'event' }])));

      expect(wrapper.text()).toContain('Found 1 function in the ABI.');
      expect(saveBtn(wrapper).attributes('disabled')).toBeUndefined();
    });

    test('a build artifact with an "abi" field is accepted (plural count)', async () => {
      const wrapper = await readyForUpload();
      await uploadFile(wrapper, fileOf(JSON.stringify({ abi: [fnAbi('a'), fnAbi('b')] })));
      expect(wrapper.text()).toContain('Found 2 functions in the ABI.');
    });

    test('invalid JSON shows a parse error and keeps save disabled', async () => {
      const wrapper = await readyForUpload();
      await uploadFile(wrapper, fileOf('not json'));

      expect(wrapper.text()).toContain('File is not valid JSON');
      expect(saveBtn(wrapper).attributes('disabled')).toBeDefined();
    });

    test('JSON without an ABI shows an error', async () => {
      const wrapper = await readyForUpload();
      await uploadFile(wrapper, fileOf('{"foo":1}'));
      expect(wrapper.text()).toContain('Could not find an ABI in this file');
    });

    test('a file still loading is not parsed yet', async () => {
      const wrapper = await readyForUpload();
      await uploadFile(wrapper, fileOf('[]', 40));
      expect(wrapper.text()).not.toContain('Found 0 function');
      expect(saveBtn(wrapper).attributes('disabled')).toBeDefined();
    });

    test('removing the file clears a previous ABI and error', async () => {
      const wrapper = await readyForUpload();
      await uploadFile(wrapper, fileOf('not json'));
      await uploadFile(wrapper, null);

      expect(wrapper.text()).not.toContain('File is not valid JSON');
      expect(wrapper.text()).toContain('Upload a raw ABI JSON array');
      expect(saveBtn(wrapper).attributes('disabled')).toBeDefined();
    });
  });

  describe('lookup lifecycle', () => {
    test('typing again before the debounce elapses runs only one lookup', async () => {
      const wrapper = mountPage();
      await typeIdentifier(wrapper, '0.0.1');
      await vi.advanceTimersByTimeAsync(200);
      await typeIdentifier(wrapper, '0.0.2');
      await settle();

      expect(mocks.getContractInfo).toHaveBeenCalledTimes(1);
      expect(mocks.getContractInfo).toHaveBeenCalledWith('0.0.2', expect.any(String), expect.anything());
    });

    test('clearing the identifier resets the previous lookup result', async () => {
      const wrapper = mountPage();
      await lookup(wrapper);
      expect(wrapper.text()).toContain(`EVM address: ${EVM}`);

      await typeIdentifier(wrapper, '');
      expect(wrapper.text()).not.toContain('EVM address:');
      expect(wrapper.text()).toContain('Enter a Contract ID (e.g. 0.0.1234)');
    });

    test('stale mirror node results are ignored after the identifier changes', async () => {
      let release!: (v: unknown) => void;
      mocks.getContractInfo.mockImplementationOnce(() => new Promise(r => (release = r)));
      const wrapper = mountPage();
      await lookup(wrapper, '0.0.1');
      await typeIdentifier(wrapper, '0.0.2');

      release(info);
      await flushPromises();
      expect(wrapper.text()).toContain('Looking up contract');
      expect(mocks.getVerifiedContract).not.toHaveBeenCalled();
    });

    test('stale Sourcify results are ignored after the identifier changes', async () => {
      let release!: (v: unknown) => void;
      mocks.getVerifiedContract.mockImplementationOnce(() => new Promise(r => (release = r)));
      const wrapper = mountPage();
      await lookup(wrapper, '0.0.1');
      await typeIdentifier(wrapper, '0.0.2');

      release(verifiedResult());
      await flushPromises();
      expect(wrapper.find('[data-testid="text-contract-verified"]').exists()).toBe(false);
    });

    test('errors from an aborted (superseded) lookup are ignored', async () => {
      let fail!: (e: unknown) => void;
      mocks.getContractInfo.mockImplementationOnce(() => new Promise((_, rej) => (fail = rej)));
      const wrapper = mountPage();
      await lookup(wrapper, '0.0.1');
      await typeIdentifier(wrapper, '0.0.2');

      fail(new Error('canceled'));
      await flushPromises();
      expect(wrapper.text()).not.toContain('Could not look up this contract');
    });

    test('switching network or mirror node re-runs the lookup', async () => {
      const wrapper = mountPage();
      await lookup(wrapper);
      mocks.networkStore.network = 'mainnet';
      await nextTick();
      await settle();
      expect(mocks.getVerifiedContract).toHaveBeenLastCalledWith('mainnet', EVM, expect.anything());

      mocks.networkStore.mirrorNodeBaseURL = 'https://other.example';
      await nextTick();
      await settle();
      expect(mocks.getContractInfo).toHaveBeenLastCalledWith(
        CONTRACT_ID,
        'https://other.example',
        expect.anything(),
      );
    });

    test('unmounting cancels a pending lookup', async () => {
      const wrapper = mountPage();
      await typeIdentifier(wrapper, CONTRACT_ID);
      wrapper.unmount();
      await settle();
      expect(mocks.getContractInfo).not.toHaveBeenCalled();
    });

    test('unmounting with nothing pending is safe', () => {
      const wrapper = mountPage();
      expect(() => wrapper.unmount()).not.toThrow();
    });
  });
});
