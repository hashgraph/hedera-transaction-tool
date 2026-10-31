// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import type { RecoveryPhrase } from '@renderer/types';
import SetupPersonal from '@renderer/pages/Migrate/components/SetupPersonal.vue';
import { ACCOUNT_SETUP_STARTED } from '@shared/constants';

import { buttonStub, inputStub } from './migrationStubs';

const mocks = vi.hoisted(() => ({
  getStaticUser: vi.fn(),
  initializeUseKeychain: vi.fn(),
  isKeychainAvailable: vi.fn(),
  registerLocal: vi.fn(),
  restorePrivateKey: vi.fn(),
  storeKeyPair: vi.fn(),
  setStoredClaim: vi.fn(),
  encryptString: vi.fn(),
  safeStorage: { status: 2 },
}));

vi.mock('@renderer/services/safeStorageService', () => ({
  getStaticUser: mocks.getStaticUser,
  initializeUseKeychain: mocks.initializeUseKeychain,
  isKeychainAvailable: mocks.isKeychainAvailable,
}));
vi.mock('@renderer/services/userService', () => ({ registerLocal: mocks.registerLocal }));
vi.mock('@renderer/services/keyPairService', () => ({
  restorePrivateKey: mocks.restorePrivateKey,
  storeKeyPair: mocks.storeKeyPair,
}));
vi.mock('@renderer/services/claimService', () => ({ setStoredClaim: mocks.setStoredClaim }));
vi.mock('@renderer/stores/storeSafeStorage.ts', () => ({
  default: () => ({ ...mocks.safeStorage, encryptString: mocks.encryptString }),
  SafeStorageStatus: { notDetermined: 0, denied: 1, authorized: 2 },
}));
vi.mock('@renderer/utils', () => ({
  safeAwait: async (promise: Promise<unknown>) => {
    try {
      return { data: await promise };
    } catch (error) {
      return { error };
    }
  },
  isEmail: (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
  isPasswordStrong: (value: string) => ({ result: value.length >= 10, length: value.length >= 10 }),
}));

const RECOVERY_PHRASE = {
  words: ['inmate', 'modify', 'chronic'],
  hash: 'phrase-hash',
} as RecoveryPhrase;
const RESTORED_KEY = {
  publicKey: { toStringRaw: () => 'public-key-0' },
  toStringRaw: () => 'private-key-0',
};

const mountStep = (recoveryPhrase?: RecoveryPhrase) =>
  mount(SetupPersonal, {
    props: { recoveryPhrase },
    global: {
      stubs: {
        AppButton: buttonStub,
        AppInput: inputStub,
        AppPasswordInput: inputStub,
        AppSeparator: true,
      },
    },
  });

const submitPassword = async (
  wrapper: ReturnType<typeof mountStep>,
  email: string,
  password: string,
) => {
  await wrapper.get('[data-testid="input-email"]').setValue(email);
  await wrapper.get('[data-testid="input-password"]').setValue(password);
  await wrapper.get('form').trigger('submit');
  await flushPromises();
};

describe('Migrate: personal setup step', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.safeStorage.status = 2;
    mocks.isKeychainAvailable.mockResolvedValue(true);
    mocks.registerLocal.mockResolvedValue({ id: 'personal-id' });
    mocks.getStaticUser.mockResolvedValue({ id: 'static-id' });
    mocks.restorePrivateKey.mockResolvedValue(RESTORED_KEY);
    mocks.encryptString.mockResolvedValue('encrypted');
  });

  describe('with email and password', () => {
    test('registers the local user and reports it to the wizard', async () => {
      const wrapper = mountStep();

      await submitPassword(wrapper, 'user@example.com', 'a-strong-password');

      expect(mocks.registerLocal).toHaveBeenCalledWith(
        'user@example.com',
        'a-strong-password',
        true,
      );
      expect(wrapper.emitted('setPersonalUser')).toEqual([
        [
          {
            personalId: 'personal-id',
            useKeychain: false,
            email: 'user@example.com',
            password: 'a-strong-password',
          },
        ],
      ]);
    });

    test('flags the account setup as started so an interrupted migration can be detected', async () => {
      await submitPassword(mountStep(), 'user@example.com', 'a-strong-password');

      expect(mocks.setStoredClaim).toHaveBeenCalledWith(
        'personal-id',
        ACCOUNT_SETUP_STARTED,
        'true',
      );
    });

    test('restores key 0 from the migrated recovery phrase, encrypted with the new password', async () => {
      await submitPassword(mountStep(RECOVERY_PHRASE), 'user@example.com', 'a-strong-password');

      expect(mocks.restorePrivateKey).toHaveBeenCalledWith(
        RECOVERY_PHRASE.words,
        '',
        0,
        'ED25519',
      );
      expect(mocks.storeKeyPair).toHaveBeenCalledWith(
        {
          user_id: 'personal-id',
          index: 0,
          public_key: 'public-key-0',
          private_key: 'private-key-0',
          type: 'ED25519',
          organization_id: null,
          organization_user_id: null,
          secret_hash: 'phrase-hash',
          nickname: null,
        },
        'a-strong-password',
        false,
      );
    });

    test('restores no key when the recovery phrase step was skipped', async () => {
      await submitPassword(mountStep(), 'user@example.com', 'a-strong-password');

      expect(mocks.restorePrivateKey).not.toHaveBeenCalled();
      expect(mocks.storeKeyPair).not.toHaveBeenCalled();
    });

    test('rejects an invalid email', async () => {
      const wrapper = mountStep();

      await submitPassword(wrapper, 'not-an-email', 'a-strong-password');

      expect(wrapper.find('[data-testid="invalid-text-email"]').exists()).toBe(true);
      expect(mocks.registerLocal).not.toHaveBeenCalled();
      expect(wrapper.emitted('setPersonalUser')).toBeUndefined();
    });

    test('rejects a password shorter than 10 characters', async () => {
      const wrapper = mountStep();

      await submitPassword(wrapper, 'user@example.com', 'short');

      expect(mocks.registerLocal).not.toHaveBeenCalled();
      expect(wrapper.emitted('setPersonalUser')).toBeUndefined();
    });
  });

  describe('with the keychain', () => {
    const useKeychain = async (wrapper: ReturnType<typeof mountStep>) => {
      await flushPromises();
      await wrapper.get('[data-testid="button-setup-personal-keychain"]').trigger('click');
      await flushPromises();
    };

    test('uses the static keychain user and does not register a local password user', async () => {
      const wrapper = mountStep();

      await useKeychain(wrapper);

      expect(mocks.registerLocal).not.toHaveBeenCalled();
      expect(wrapper.emitted('setPersonalUser')).toEqual([
        [{ personalId: 'static-id', useKeychain: true, email: null, password: null }],
      ]);
    });

    test('restores key 0 without a password so it is protected by the keychain', async () => {
      await useKeychain(mountStep(RECOVERY_PHRASE));

      expect(mocks.storeKeyPair).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'static-id', index: 0 }),
        null,
        false,
      );
    });

    test('does not continue when access to the keychain is not granted', async () => {
      mocks.encryptString.mockResolvedValue(null);
      const wrapper = mountStep();

      await useKeychain(wrapper);

      expect(wrapper.emitted('setPersonalUser')).toBeUndefined();
    });

    test('is not offered when the keychain is unavailable', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(false);
      const wrapper = mountStep();
      await flushPromises();

      expect(wrapper.find('[data-testid="button-setup-personal-keychain"]').exists()).toBe(false);
    });

    test('is disabled when access to the keychain was denied', async () => {
      mocks.safeStorage.status = 1;
      const wrapper = mountStep();
      await flushPromises();

      expect(
        wrapper.get('[data-testid="button-setup-personal-keychain"]').attributes('disabled'),
      ).toBeDefined();
    });
  });

  test('Cancel stops the migration', async () => {
    const wrapper = mountStep();

    await wrapper.get('[data-testid="button-migration-cancel"]').trigger('click');

    expect(wrapper.emitted('migration:cancel')).toHaveLength(1);
  });
});
