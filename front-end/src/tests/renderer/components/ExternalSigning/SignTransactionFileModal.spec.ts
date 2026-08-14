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
    getMirrorNodeREST: () => 'https://mirror.testnet.hedera.com',
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

const ITEM = { transactionBytes: 'aabbcc' };
const FILE = { network: 'testnet', items: [ITEM] };

/* ── Mount helper ────────────────────────────────────────────────────────── */

function mountModal() {
  return mount(SignTransactionFileModal, {
    props: {
      filePath: '/path/to/file.json',
      show: true,
      'onUpdate:show': vi.fn(),
    },
    global: {
      stubs: {
        AppModal: { template: '<div><slot /></div>' },
        AppButton: { template: '<button type="submit"><slot /></button>' },
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
    mocks.readTransactionFile.mockResolvedValue(FILE);
    mocks.filterItems.mockResolvedValue({ needSigning: [ITEM], fullySigned: [] });
    mocks.collectMissingSignerKeys.mockResolvedValue(['pubkey1']);
    mocks.writeTransactionFile.mockResolvedValue(undefined);
  });

  test('shows error toast and does not write file when signing fails', async () => {
    mocks.signTransaction.mockRejectedValue(new Error('Decryption failed'));

    const wrapper = mountModal();
    await flushPromises(); // let watch + readTransactionFile + filterItems settle

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.toastError).toHaveBeenCalledWith(
      'Failed to sign transaction. Please delete the private key and re-add it. For more help, contact your administrator.',
    );
    expect(mocks.writeTransactionFile).not.toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to sign transaction file entry',
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  test('writes file and does not show error when signing succeeds', async () => {
    mocks.signTransaction.mockResolvedValue(new Uint8Array([0xde, 0xad]));

    const wrapper = mountModal();
    await flushPromises();

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.writeTransactionFile).toHaveBeenCalledTimes(1);
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
});
