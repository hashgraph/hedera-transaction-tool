// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

import SignTransactionFileModal from '@renderer/components/ExternalSigning/SignTransactionFileModal.vue';

/* ── Hoisted mocks ───────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  exportTransactionFile: vi.fn(),
  signTransaction: vi.fn(),
  readTransactionFile: vi.fn(),
  filterItems: vi.fn(),
  collectMissingSignerKeys: vi.fn(),
  loggerError: vi.fn(),
  loggerDebug: vi.fn(),
  currentNetwork: 'testnet',
  getPasswordAsync: vi.fn(),
}));

vi.mock('@renderer/composables/usePersonalPassword', () => ({
  default: vi.fn(() => ({ getPasswordAsync: mocks.getPasswordAsync })),
}));

vi.mock('@renderer/services/transactionFileService.ts', () => ({
  exportTransactionFile: mocks.exportTransactionFile,
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

const ITEM = { transactionBytes: ORIGINAL_HEX, name: 'Transaction', description: '', creatorEmail: '' };
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

function mountModal(file = FILE) {
  return mount(SignTransactionFileModal, {
    props: {
      suggestedName: 'original.tx2',
      initialTransactionFile: file,
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
    mocks.filterItems.mockResolvedValue({ needSigning: [ITEM], fullySigned: [] });
    mocks.collectMissingSignerKeys.mockResolvedValue(['pubkey1']);
    mocks.exportTransactionFile.mockResolvedValue(true);
    // Simulates a user on OS keychain, so signing proceeds without a password prompt by default.
    mocks.getPasswordAsync.mockResolvedValue(null);
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
    expect(mocks.exportTransactionFile).not.toHaveBeenCalled();
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
    expect(mocks.exportTransactionFile).toHaveBeenCalledTimes(1);
    expect(mocks.exportTransactionFile).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ transactionBytes: SIGNED_HEX })],
      }),
      'original.tx2',
    );
    // Success modal must appear
    expect(wrapper.find('[data-testid="button-close"]').exists()).toBe(true);
  });

  test('does not show success when the user cancels the save dialog', async () => {
    mocks.signTransaction.mockResolvedValue(new Uint8Array([0xde, 0xad]));
    mocks.exportTransactionFile.mockResolvedValue(false);

    const wrapper = mountModal();
    await flushPromises();
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.exportTransactionFile).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="button-close"]').exists()).toBe(false);
  });

  test('stops at first failure and does not sign subsequent items', async () => {
    const item2 = { transactionBytes: 'ccddee', name: 'Second', description: '', creatorEmail: '' };
    const fileWith2Items = { network: 'testnet', items: [ITEM, item2] };

    mocks.filterItems.mockResolvedValue({ needSigning: [ITEM, item2], fullySigned: [] });
    mocks.signTransaction.mockRejectedValue(new Error('Decryption failed'));

    const wrapper = mountModal(fileWith2Items);
    await flushPromises();

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    // signTransaction attempted only once — loop exited on first failure
    expect(mocks.signTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.exportTransactionFile).not.toHaveBeenCalled();
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
    const wrapper = mountModal({
      network: 'mirror.attacker.example',
      items: [ITEM],
    });
    await flushPromises();

    expect(mocks.filterItems).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith('Unknown network in transaction file.');
    expect(wrapper.find('[data-testid="button-close-network-mismatch"]').exists()).toBe(false);
  });

  test('reports an HTTP transaction-file endpoint as requiring HTTPS', async () => {
    mountModal({ network: 'http://mainnet.example', items: [ITEM] });
    await flushPromises();

    expect(mocks.filterItems).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith('Unknown network in transaction file.');
  });

  test('uses the exact custom mirror endpoint already configured in Settings', async () => {
    mocks.currentNetwork = 'custom.mirror.example/v1';
    mountModal({
      network: 'https://custom.mirror.example/v1/',
      items: [ITEM],
    });
    await flushPromises();

    expect(mocks.filterItems).toHaveBeenCalledWith(
      [ITEM],
      ['pubkey1'],
      'https://custom.mirror.example/v1',
      expect.anything(),
    );
  });

  describe('password prompt', () => {
    test('prompts for the application password and signs with it when none is cached', async () => {
      mocks.getPasswordAsync.mockResolvedValueOnce('typed-password');
      mocks.signTransaction.mockResolvedValue(new Uint8Array([0xde, 0xad]));

      const wrapper = mountModal();
      await flushPromises();
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(mocks.signTransaction).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        ['pubkey1'],
        'user-1',
        'typed-password',
        false,
      );
      expect(mocks.exportTransactionFile).toHaveBeenCalledTimes(1);
    });

    // Regression test: this used to throw "Password is required to sign" instead
    // of prompting, surfacing as an unhandled-error toast with no way to recover.
    test('quietly aborts without signing, writing, or showing an error when the user cancels the password prompt', async () => {
      mocks.getPasswordAsync.mockResolvedValueOnce(false);

      const wrapper = mountModal();
      await flushPromises();
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(mocks.signTransaction).not.toHaveBeenCalled();
      expect(mocks.exportTransactionFile).not.toHaveBeenCalled();
      expect(mocks.toastError).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="button-close"]').exists()).toBe(false);
    });
  });
});
