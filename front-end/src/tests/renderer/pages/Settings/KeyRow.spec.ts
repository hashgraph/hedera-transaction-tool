// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { PrivateKey } from '@hiero-ledger/sdk';

const mocks = vi.hoisted(() => ({
  user: {
    publicKeyToAccounts: [] as { publicKey: string; accounts: { account: string }[] }[],
    selectedOrganization: null,
    personal: { id: 'user-1' },
  },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: () => mocks.user }));
vi.mock('@renderer/stores/storeNetwork', () => ({ default: () => ({ network: 'testnet' }) }));
vi.mock('@renderer/composables/usePersonalPassword', () => ({
  default: () => ({ getPasswordAsync: vi.fn() }),
}));
vi.mock('@renderer/services/keyPairService', () => ({ decryptPrivateKey: vi.fn() }));
vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => mocks.toast },
}));

import KeyRow from '@renderer/pages/Settings/components/KeysTab/components/KeyRow.vue';
import { KeyInfo } from '@renderer/composables/useKeyManager';

const ed25519 = PrivateKey.generateED25519().publicKey.toStringRaw();
const ecdsa = PrivateKey.generateECDSA().publicKey.toStringRaw();

const keyPair = (publicKey: string, overrides: Record<string, unknown> = {}) =>
  ({
    id: 'kp-1',
    public_key: publicKey,
    private_key: 'enc',
    index: -1,
    nickname: null,
    secret_hash: null,
    ...overrides,
  }) as never;

function mountRow(keyInfo: KeyInfo, rowIndex = 0) {
  return mount(KeyRow, {
    props: { keyInfo, checked: false, enableDelete: true, rowIndex },
    global: {
      stubs: {
        AppButton: { template: '<button v-bind="$attrs"><slot /></button>' },
        AppCheckBox: { template: '<input type="checkbox" />' },
      },
    },
  });
}

const cell = (wrapper: ReturnType<typeof mountRow>, name: string, row = 0) =>
  wrapper.find(`[data-testid="cell-${name}-${row}"]`);

describe('KeyRow.vue', () => {
  beforeEach(() => {
    mocks.toast.success.mockReset();
    mocks.toast.error.mockReset();
    mocks.user.publicKeyToAccounts = [];
    mocks.user.selectedOrganization = null;
  });

  describe('key type', () => {
    test('shows ED25519 for an ED25519 key', () => {
      const wrapper = mountRow(new KeyInfo(ed25519, keyPair(ed25519), null));

      expect(cell(wrapper, 'key-type').text()).toBe('ED25519');
    });

    test('shows ECDSA for an ECDSA key', () => {
      const wrapper = mountRow(new KeyInfo(ecdsa, keyPair(ecdsa), null));

      expect(cell(wrapper, 'key-type').text()).toBe('ECDSA');
    });
  });

  describe('index and nickname', () => {
    test('shows N/A as the index of a key that is not derived from a recovery phrase', () => {
      const wrapper = mountRow(new KeyInfo(ecdsa, keyPair(ecdsa, { index: -1 }), null));

      expect(cell(wrapper, 'index').text()).toBe('N/A');
    });

    test('shows the index of a key derived from a recovery phrase', () => {
      const wrapper = mountRow(
        new KeyInfo(ecdsa, keyPair(ecdsa, { index: 4, secret_hash: 'h' }), null),
      );

      expect(cell(wrapper, 'index').text()).toBe('4');
    });

    test('shows the nickname, or N/A when there is none', () => {
      const named = mountRow(new KeyInfo(ed25519, keyPair(ed25519, { nickname: 'My key' }), null));
      const unnamed = mountRow(new KeyInfo(ed25519, keyPair(ed25519), null));

      expect(cell(named, 'nickname').text()).toContain('My key');
      expect(cell(unnamed, 'nickname').text()).toContain('N/A');
    });
  });

  describe('account id', () => {
    test('shows N/A when the key has no account', () => {
      const wrapper = mountRow(new KeyInfo(ed25519, keyPair(ed25519), null));

      expect(cell(wrapper, 'account').text()).toBe('N/A');
    });

    test('shows the first account of the key', () => {
      mocks.user.publicKeyToAccounts = [
        { publicKey: ed25519, accounts: [{ account: '0.0.1001' }, { account: '0.0.1002' }] },
      ];
      const wrapper = mountRow(new KeyInfo(ed25519, keyPair(ed25519), null));

      expect(cell(wrapper, 'account').text()).toContain('0.0.1001');
      expect(cell(wrapper, 'account').text()).not.toContain('0.0.1002');
    });

    test('ignores the accounts of other keys', () => {
      mocks.user.publicKeyToAccounts = [{ publicKey: ecdsa, accounts: [{ account: '0.0.2001' }] }];
      const wrapper = mountRow(new KeyInfo(ed25519, keyPair(ed25519), null));

      expect(cell(wrapper, 'account').text()).toBe('N/A');
    });
  });

  describe('copying the public key', () => {
    const copyTestId = 'span-copy-public-key-0';
    let writeText: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeText = vi.fn();
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    });

    test('copies it and reports success', async () => {
      writeText.mockResolvedValue(undefined);
      const wrapper = mountRow(new KeyInfo(ed25519, keyPair(ed25519), null));

      await wrapper.find(`[data-testid="${copyTestId}"]`).trigger('click');
      await flushPromises();

      expect(writeText).toHaveBeenCalledWith(ed25519);
      expect(mocks.toast.success).toHaveBeenCalledWith('Public Key copied successfully');
    });

    test('reports an error, not success, when the clipboard write fails', async () => {
      writeText.mockRejectedValue(new Error('Write permission denied.'));
      const wrapper = mountRow(new KeyInfo(ed25519, keyPair(ed25519), null));

      await wrapper.find(`[data-testid="${copyTestId}"]`).trigger('click');
      await flushPromises();

      expect(mocks.toast.error).toHaveBeenCalledWith('Write permission denied.');
      expect(mocks.toast.success).not.toHaveBeenCalled();
    });
  });
});
