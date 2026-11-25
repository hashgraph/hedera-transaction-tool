// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { PrivateKey } from '@hiero-ledger/sdk';

const mocks = vi.hoisted(() => ({
  user: {
    personal: { id: 'user-1' },
    selectedOrganization: null,
    recoveryPhrase: null as { words: string[]; hash: string } | null,
    secretHashes: [] as string[],
    storeKey: vi.fn(),
    refetchUserState: vi.fn(),
  },
  restorePrivateKey: vi.fn(),
  getPassword: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  push: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: () => mocks.user }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@renderer/composables/usePersonalPassword', () => ({
  default: () => ({ getPassword: mocks.getPassword, passwordModalOpened: () => false }),
}));
vi.mock('@renderer/services/keyPairService', () => ({
  restorePrivateKey: mocks.restorePrivateKey,
}));
vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => mocks.toast },
}));
vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  assertUserLoggedIn: vi.fn(),
  getWidthOfElementWithText: () => 1,
}));

import KeyPairs from '@renderer/pages/AccountSetup/components/KeyPairs.vue';

const ed25519 = PrivateKey.generateED25519();
const ecdsa = PrivateKey.generateECDSA();

const existingKeyPair = (key: PrivateKey, overrides: Record<string, unknown> = {}) =>
  ({
    id: 'kp-1',
    public_key: key.publicKey.toStringRaw(),
    private_key: key.toStringRaw(),
    index: 4,
    nickname: null,
    secret_hash: 'existing-hash',
    ...overrides,
  }) as never;

async function mountKeyPairs(selectedPersonalKeyPair: unknown = null) {
  const wrapper = mount(KeyPairs, {
    props: { selectedPersonalKeyPair: selectedPersonalKeyPair as never },
  });
  await flushPromises();
  return wrapper;
}

const savedKeyPair = () => mocks.user.storeKey.mock.calls[0][0];

describe('AccountSetup KeyPairs.vue - key type', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.recoveryPhrase = null;
    mocks.user.selectedOrganization = null;
    mocks.user.secretHashes = [];
    mocks.getPassword.mockReturnValue('pw');
    mocks.user.storeKey.mockResolvedValue(undefined);
    mocks.user.refetchUserState.mockResolvedValue(undefined);
  });

  describe('a new account', () => {
    test('restores its default key as ED25519', async () => {
      mocks.user.recoveryPhrase = { words: ['w1'], hash: 'phrase-hash' };
      mocks.restorePrivateKey.mockResolvedValue(ed25519);

      const wrapper = await mountKeyPairs();
      await (wrapper.vm as unknown as { handleSave: () => Promise<void> }).handleSave();

      expect(mocks.restorePrivateKey).toHaveBeenCalledWith(['w1'], '', 0, 'ED25519');
      expect(savedKeyPair().type).toBe('ED25519');
      expect(wrapper.find('[data-testid="label-key-type"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="label-private-key"]').text()).toContain('ED25519');
    });
  });

  describe('restoring an existing key pair', () => {
    test('derives and saves an ECDSA key as ECDSA', async () => {
      mocks.user.recoveryPhrase = { words: ['w1'], hash: 'phrase-hash' };
      mocks.restorePrivateKey.mockResolvedValue(ecdsa);

      const wrapper = await mountKeyPairs(existingKeyPair(ecdsa));
      await (wrapper.vm as unknown as { handleSave: () => Promise<void> }).handleSave();

      expect(mocks.restorePrivateKey).toHaveBeenCalledWith(['w1'], '', 4, 'ECDSA');
      expect(mocks.toast.error).not.toHaveBeenCalled();
      expect(savedKeyPair()).toMatchObject({
        type: 'ECDSA',
        public_key: ecdsa.publicKey.toStringRaw(),
        index: 4,
      });
    });

    test('shows ECDSA as the key type and in the key labels', async () => {
      mocks.user.recoveryPhrase = { words: ['w1'], hash: 'phrase-hash' };
      mocks.restorePrivateKey.mockResolvedValue(ecdsa);

      const wrapper = await mountKeyPairs(existingKeyPair(ecdsa));

      expect(
        (wrapper.find('[data-testid="input-key-type"]').element as HTMLInputElement).value,
      ).toBe('ECDSA');
      expect(wrapper.find('[data-testid="label-private-key"]').text()).toContain('ECDSA');
      expect(wrapper.find('[data-testid="label-public-key"]').text()).toContain('ECDSA');
    });

    test('keeps the type of an ECDSA key that is copied without a recovery phrase', async () => {
      const wrapper = await mountKeyPairs(existingKeyPair(ecdsa));
      await (wrapper.vm as unknown as { handleSave: () => Promise<void> }).handleSave();

      expect(mocks.restorePrivateKey).not.toHaveBeenCalled();
      expect(savedKeyPair().type).toBe('ECDSA');
    });

    test('still restores an ED25519 key as ED25519', async () => {
      mocks.user.recoveryPhrase = { words: ['w1'], hash: 'phrase-hash' };
      mocks.restorePrivateKey.mockResolvedValue(ed25519);

      const wrapper = await mountKeyPairs(existingKeyPair(ed25519));
      await (wrapper.vm as unknown as { handleSave: () => Promise<void> }).handleSave();

      expect(mocks.restorePrivateKey).toHaveBeenCalledWith(['w1'], '', 4, 'ED25519');
      expect(savedKeyPair().type).toBe('ED25519');
    });

    test('names the expected type when the phrase does not produce the existing key', async () => {
      mocks.user.recoveryPhrase = { words: ['w1'], hash: 'phrase-hash' };
      mocks.restorePrivateKey.mockResolvedValue(PrivateKey.generateECDSA());

      await mountKeyPairs(existingKeyPair(ecdsa));

      expect(mocks.toast.error).toHaveBeenCalledWith(
        expect.stringContaining('ensure that the key type is ECDSA'),
      );
    });
  });
});
