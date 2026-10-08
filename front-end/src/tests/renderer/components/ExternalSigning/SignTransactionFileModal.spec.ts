// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

import SignTransactionFileModal from '@renderer/components/ExternalSigning/SignTransactionFileModal.vue';

/* ── Hoisted mocks ───────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  writeTransactionFile: vi.fn(),
  signTransaction: vi.fn(),
  readTransactionFile: vi.fn(),
  filterItems: vi.fn(),
  collectMissingSignerKeys: vi.fn(),
  loggerError: vi.fn(),
  loggerDebug: vi.fn(),
  currentNetwork: 'testnet',
}));

vi.mock('@renderer/services/transactionFileService.ts', () => ({
  readTransactionFile: mocks.readTransactionFile,
  writeTransactionFile: mocks.writeTransactionFile,
}));

vi.mock('@renderer/utils/transactionFileSigning.ts', () => ({
  filterTransactionFileItemsToBeSigned: mocks.filterItems,
  collectMissingSignerKeys: mocks.collectMissingSignerKeys,
}));

vi.mock('@renderer/services/transactionService.ts', () => ({
  signTransaction: mocks.signTransaction,
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => ({ error: mocks.toastError }) },
}));

vi.mock('@renderer/stores/storeUser.ts', () => ({
  default: () => ({
    personal: { isLoggedIn: true, id: 'user-1', useKeychain: true, password: null },
    publicKeys: ['pubkey1'],
    getPassword: () => null,
  }),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: () => ({
    network: mocks.currentNetwork,
    getMirrorNodeREST: (network: string) => `https://${network}`,
    isCurrentNetwork: (network: string) =>
      network.replace(/^https?:\/\//, '').replace(/\/$/, '') ===
      mocks.currentNetwork.replace(/^https?:\/\//, '').replace(/\/$/, ''),
  }),
}));

vi.mock('@renderer/caches/AppCache.ts', () => ({
  AppCache: { inject: () => ({}) },
}));

vi.mock('@renderer/utils/logger', () => ({
  createLogger: () => ({
    debug: mocks.loggerDebug,
    error: mocks.loggerError,
    info: vi.fn(),
  }),
}));

vi.mock('@hiero-ledger/sdk', () => ({
  Transaction: { fromBytes: vi.fn(() => ({})) },
  SignatureMap: {
    _fromTransaction: vi.fn(() => ({ getFlatSignatureList: vi.fn(() => []) })),
  },
}));

vi.mock('@renderer/utils', () => ({
  assertUserLoggedIn: vi.fn(),
  hexToUint8Array: vi.fn(() => new Uint8Array([1, 2, 3])),
  uint8ToHex: vi.fn(() => 'aabbcc'),
}));

/* ── Fixtures ────────────────────────────────────────────────────────────── */

// Deliberately distinct from the SIGNED_HEX returned by the uint8ToHex mock so
// tests can tell whether the written file contains original or updated bytes.
const ORIGINAL_HEX = '001122';
const SIGNED_HEX = 'aabbcc';

const ITEM = { transactionBytes: ORIGINAL_HEX };
const FILE = { network: 'testnet', items: [ITEM] };

/* ── Mount helper ────────────────────────────────────────────────────────── */

// AppModal stub respects the `show` prop so tests can assert on whether the
// success modal is actually rendered, which is the core behaviour this PR fixes.
const AppModalStub = {
  props: ['show'],
  template: '<div v-if="show"><slot /></div>',
};

// AppButton stub forwards attributes so data-testid selectors work.
const AppButtonStub = {
  template: '<button v-bind="$attrs" type="submit"><slot /></button>',
};

function mountModal() {
  return mount(SignTransactionFileModal, {
    props: {
      filePath: '/path/to/file.json',
      show: true,
      'onUpdate:show': vi.fn(),
    },
    global: {
      stubs: {
        AppModal: AppModalStub,
        AppButton: AppButtonStub,
        TransactionBrowser: { template: '<div />' },
        AppCustomIcon: { template: '<div />' },
      },
    },
  });
}

/* ── Tests ───────────────────────────────────────────────────────────────── */

describe('SignTransactionFileModal – handleSignAll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentNetwork = 'testnet';
    mocks.readTransactionFile.mockResolvedValue(FILE);
    mocks.filterItems.mockResolvedValue({ needSigning: [ITEM], fullySigned: [] });
    mocks.collectMissingSignerKeys.mockResolvedValue(['pubkey1']);
    mocks.writeTransactionFile.mockResolvedValue(undefined);
  });

  test('shows error toast, does not write file, and does not show success modal when signing fails', async () => {
    mocks.signTransaction.mockRejectedValue(new Error('Decryption failed'));

    const wrapper = mountModal();
    await flushPromises(); // let watch + readTransactionFile + filterItems settle

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.toastError).toHaveBeenCalledWith(
      'Decryption failed Please delete the private key and re-add it. For more help, contact your administrator.',
    );
    expect(mocks.writeTransactionFile).not.toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to sign transaction file entry',
      expect.objectContaining({ error: expect.any(Error) }),
    );
    // Success modal must not appear
    expect(wrapper.find('[data-testid="button-close"]').exists()).toBe(false);
  });

  test('writes file with signed bytes, shows success modal, and does not show error when signing succeeds', async () => {
    mocks.signTransaction.mockResolvedValue(new Uint8Array([0xde, 0xad]));

    const wrapper = mountModal();
    await flushPromises();

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.toastError).not.toHaveBeenCalled();
    // File must be written with the updated (signed) bytes, not the original ones
    expect(mocks.writeTransactionFile).toHaveBeenCalledTimes(1);
    expect(mocks.writeTransactionFile).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ transactionBytes: SIGNED_HEX })],
      }),
      '/path/to/file.json',
    );
    // Success modal must appear
    expect(wrapper.find('[data-testid="button-close"]').exists()).toBe(true);
  });

  test('stops at first failure and does not sign subsequent items', async () => {
    const item2 = { transactionBytes: 'ccddee' };
    const fileWith2Items = { network: 'testnet', items: [ITEM, item2] };

    mocks.readTransactionFile.mockResolvedValue(fileWith2Items);
    mocks.filterItems.mockResolvedValue({ needSigning: [ITEM, item2], fullySigned: [] });
    mocks.signTransaction.mockRejectedValue(new Error('Decryption failed'));

    const wrapper = mountModal();
    await flushPromises();

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    // signTransaction attempted only once — loop exited on first failure
    expect(mocks.signTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.writeTransactionFile).not.toHaveBeenCalled();
  });

  test('blocks signing and asks the user to switch networks when they differ', async () => {
    mocks.currentNetwork = 'mainnet';
    const wrapper = mountModal();
    await flushPromises();

    expect(wrapper.text()).toContain('This file is for Testnet');
    expect(mocks.filterItems).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Switch to Testnet in Settings');
    expect(wrapper.find('[data-testid="button-close-network-mismatch"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="button-confirm-network"]').exists()).toBe(false);
  });

  test('rejects a custom mirror endpoint from the file unless it matches Settings', async () => {
    mocks.readTransactionFile.mockResolvedValue({
      network: 'mirror.attacker.example',
      items: [ITEM],
    });
    const wrapper = mountModal();
    await flushPromises();

    expect(mocks.filterItems).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith('Unknown network in transaction file.');
    expect(wrapper.find('[data-testid="button-close-network-mismatch"]').exists()).toBe(false);
  });

  test('reports an HTTP transaction-file endpoint as requiring HTTPS', async () => {
    mocks.readTransactionFile.mockRejectedValue(
      new Error('Invalid transaction file network: HTTPS is required'),
    );
    mountModal();
    await flushPromises();

    expect(mocks.filterItems).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith('Transaction file network must use HTTPS.');
  });

  test('uses the exact custom mirror endpoint already configured in Settings', async () => {
    mocks.currentNetwork = 'custom.mirror.example/v1';
    mocks.readTransactionFile.mockResolvedValue({
      network: 'https://custom.mirror.example/v1/',
      items: [ITEM],
    });
    mountModal();
    await flushPromises();

    expect(mocks.filterItems).toHaveBeenCalledWith(
      [ITEM],
      ['pubkey1'],
      'https://custom.mirror.example/v1',
      expect.anything(),
    );
  });
});
