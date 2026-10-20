// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  getPasswordAsync: vi.fn(),
  decryptEncryptedKey: vi.fn(),
  storeKeyPair: vi.fn(),
}));

vi.mock('@renderer/composables/usePersonalPassword', () => ({
  default: vi.fn(() => ({ getPasswordAsync: mocks.getPasswordAsync })),
}));

vi.mock('@renderer/services/encryptedKeys', () => ({
  calculateRecoveryPhraseHashCode: vi.fn(() => null),
  decryptEncryptedKey: mocks.decryptEncryptedKey,
}));

vi.mock('@renderer/services/keyPairService', () => ({
  storeKeyPair: mocks.storeKeyPair,
}));

vi.mock('@renderer/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@renderer/utils')>();
  return {
    ...actual,
    assertUserLoggedIn: vi.fn(),
    isLoggedInOrganization: vi.fn(() => false),
    safeDuplicateUploadKey: vi.fn(),
  };
});

vi.mock('@hiero-ledger/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@hiero-ledger/sdk')>();
  return {
    ...actual,
    PrivateKey: {
      fromStringDer: vi.fn(() => ({
        toStringRaw: () => 'decrypted-private-key',
        publicKey: {
          toStringRaw: () => 'decrypted-public-key',
          _key: { _type: 'ed25519' },
        },
      })),
    },
  };
});

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({
    personal: { id: 'user-1' },
    selectedOrganization: null,
    keyPairs: [],
  })),
}));

import DecryptKeyModal from '@renderer/components/KeyPair/ImportEncrypted/components/DecryptKeyModal.vue';

const AppPasswordInputStub = {
  props: ['modelValue'],
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
};

function mountModal(props: Partial<InstanceType<typeof DecryptKeyModal>['$props']> = {}) {
  return mount(DecryptKeyModal, {
    props: {
      show: true,
      keyPath: '/keys/my-key.pem',
      keysLeft: 1,
      ...props,
    },
    global: {
      stubs: {
        AppModal: { props: ['show'], template: '<div v-if="show"><slot /></div>' },
        AppButton: { template: '<button v-bind="$attrs"><slot /></button>' },
        AppPasswordInput: AppPasswordInputStub,
      },
    },
  });
}

describe('DecryptKeyModal.vue', () => {
  beforeEach(() => {
    mocks.decryptEncryptedKey.mockReset().mockResolvedValue({
      privateKey: 'der-encoded-private-key',
      recoveryPhraseHashCode: null,
      index: null,
    });
    mocks.storeKeyPair.mockReset().mockResolvedValue(undefined);
    // Simulates a password already cached from a prior prompt, so storing
    // proceeds without needing the modal by default.
    mocks.getPasswordAsync.mockReset().mockResolvedValue('password');
  });

  describe('password handling', () => {
    test('stores the key using the password returned by the prompt when none is cached', async () => {
      mocks.getPasswordAsync.mockResolvedValueOnce('typed-password');

      const wrapper = mountModal();
      await wrapper.find('[data-testid="input-decrypt-keys-password"]').setValue('file-password');
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(mocks.storeKeyPair).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-1', public_key: 'decrypted-public-key' }),
        'typed-password',
        false,
      );
      expect(wrapper.emitted('stored')).toBeTruthy();
    });

    // Regression test: on a multi-key import, this used to throw 'Personal password not
    // found' for keys after the first if the password cache expired mid-batch, and that
    // throw was swallowed into an unhandled rejection with no prompt and no visible error.
    test('does not store the key, and does not throw, when the user cancels the password prompt', async () => {
      mocks.getPasswordAsync.mockResolvedValueOnce(false);

      const wrapper = mountModal();
      await wrapper.find('[data-testid="input-decrypt-keys-password"]').setValue('file-password');
      await expect(wrapper.find('form').trigger('submit')).resolves.not.toThrow();
      await flushPromises();

      expect(mocks.storeKeyPair).not.toHaveBeenCalled();
      expect(wrapper.emitted('stored')).toBeFalsy();
    });
  });
});
