// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { PrivateKey } from '@hiero-ledger/sdk';

const mocks = vi.hoisted(() => ({
  getPassword: vi.fn(),
  storeExternalKeyPair: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: () => ({ personal: { id: 'user-1' } }) }));
vi.mock('@renderer/composables/usePersonalPassword', () => ({
  default: () => ({
    getPassword: mocks.getPassword,
    passwordModalOpened: (result: unknown) => result === false,
  }),
}));
vi.mock('@renderer/composables/useStoreExternalKeyPair', () => ({
  default: () => mocks.storeExternalKeyPair,
}));
vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => ({ success: mocks.toastSuccess, error: mocks.toastError }) },
}));
vi.mock('@renderer/utils/logger', () => ({ createLogger: () => mocks.logger }));
vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  assertUserLoggedIn: vi.fn(),
}));

import ImportExternalPrivateKeyModal from '@renderer/components/ImportExternalPrivateKeyModal.vue';

const stubs = {
  AppModal: { props: ['show'], template: '<div v-if="show"><slot /></div>' },
  AppButton: {
    props: ['disabled'],
    template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
  },
  AppInput: {
    props: ['modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
};

const ed25519 = PrivateKey.generateED25519();
const ecdsa = PrivateKey.generateECDSA();

function mountModal(props: Record<string, unknown> = {}) {
  return mount(ImportExternalPrivateKeyModal, {
    props: { show: true, ...props },
    global: { stubs },
  });
}

type Wrapper = ReturnType<typeof mountModal>;
const find = (wrapper: Wrapper, testid: string) => wrapper.find(`[data-testid="${testid}"]`);
const paste = (wrapper: Wrapper, key: string) => find(wrapper, 'input-private-key').setValue(key);
const selectType = async (wrapper: Wrapper, type: 'ED25519' | 'ECDSA') => {
  await find(wrapper, `select-item-${type}`).trigger('click');
};
const toggleText = (wrapper: Wrapper) => find(wrapper, 'select-private-key-type').text();
const importButton = (wrapper: Wrapper) => find(wrapper, 'button-private-key-import');
const message = (wrapper: Wrapper) => find(wrapper, 'label-key-type-message');
const submit = async (wrapper: Wrapper) => {
  await wrapper.find('form').trigger('submit');
  await flushPromises();
};

describe('ImportExternalPrivateKeyModal.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPassword.mockReturnValue('pw');
    mocks.storeExternalKeyPair.mockResolvedValue(undefined);
  });

  describe('key type dropdown', () => {
    test('starts blank', () => {
      const wrapper = mountModal();

      expect(toggleText(wrapper)).toBe('Select key type');
    });

    test('offers ED25519 and ECDSA', () => {
      const wrapper = mountModal();

      expect(find(wrapper, 'select-item-ED25519').exists()).toBe(true);
      expect(find(wrapper, 'select-item-ECDSA').exists()).toBe(true);
    });

    test('is hidden when the key type is already known', () => {
      const wrapper = mountModal({
        keyType: 'ED25519',
        publicKey: ed25519.publicKey.toStringRaw(),
      });

      expect(find(wrapper, 'select-private-key-type').exists()).toBe(false);
    });
  });

  describe('auto-detecting the key type from the pasted key', () => {
    test('fills in ED25519 for a DER-encoded ED25519 key', async () => {
      const wrapper = mountModal();

      await paste(wrapper, ed25519.toStringDer());

      expect(toggleText(wrapper)).toBe('ED25519');
      expect(message(wrapper).exists()).toBe(false);
      expect(importButton(wrapper).attributes('disabled')).toBeUndefined();
    });

    test('fills in ECDSA for a DER-encoded ECDSA key', async () => {
      const wrapper = mountModal();

      await paste(wrapper, ecdsa.toStringDer());

      expect(toggleText(wrapper)).toBe('ECDSA');
      expect(importButton(wrapper).attributes('disabled')).toBeUndefined();
    });

    test('follows the pasted key while the selection was filled in by detection', async () => {
      const wrapper = mountModal();

      await paste(wrapper, ed25519.toStringDer());
      expect(toggleText(wrapper)).toBe('ED25519');

      await paste(wrapper, ecdsa.toStringDer());
      expect(toggleText(wrapper)).toBe('ECDSA');
    });

    test('goes back to blank when the pasted key is no longer detectable', async () => {
      const wrapper = mountModal();

      await paste(wrapper, ecdsa.toStringDer());
      await paste(wrapper, ecdsa.toStringRaw());

      expect(toggleText(wrapper)).toBe('Select key type');
    });

    test('does not override a type the user chose', async () => {
      const wrapper = mountModal();

      await selectType(wrapper, 'ED25519');
      await paste(wrapper, ecdsa.toStringDer());

      expect(toggleText(wrapper)).toBe('ED25519');
    });
  });

  describe('a raw key, whose type cannot be detected', () => {
    test('asks the user to select a type, and disables Import until they do', async () => {
      const wrapper = mountModal();

      await paste(wrapper, ecdsa.toStringRaw());

      expect(message(wrapper).text()).toBe('Key type not detected. Select one.');
      expect(message(wrapper).classes()).toContain('text-danger');
      expect(importButton(wrapper).attributes('disabled')).toBeDefined();
    });

    test('allows importing once a type is selected', async () => {
      const wrapper = mountModal();
      await paste(wrapper, ecdsa.toStringRaw());

      await selectType(wrapper, 'ECDSA');

      expect(message(wrapper).exists()).toBe(false);
      expect(importButton(wrapper).attributes('disabled')).toBeUndefined();
    });

    test('does not warn about a mismatch it cannot know about', async () => {
      const wrapper = mountModal();

      await selectType(wrapper, 'ED25519');
      await paste(wrapper, ecdsa.toStringRaw());

      expect(message(wrapper).exists()).toBe(false);
      expect(importButton(wrapper).attributes('disabled')).toBeUndefined();
    });

    test('is not mistaken for an ED25519 key, which the SDK would otherwise do', async () => {
      const wrapper = mountModal();

      await paste(wrapper, ecdsa.toStringRaw());

      expect(toggleText(wrapper)).toBe('Select key type');
    });
  });

  describe('a type that does not match the pasted key', () => {
    test('warns, in red, which type the key is', async () => {
      const wrapper = mountModal();
      await selectType(wrapper, 'ED25519');

      await paste(wrapper, ecdsa.toStringDer());

      expect(message(wrapper).text()).toBe('Pasted key is ECDSA, not ED25519.');
      expect(message(wrapper).classes()).toContain('text-danger');
    });

    test('disables Import', async () => {
      const wrapper = mountModal();
      await selectType(wrapper, 'ED25519');

      await paste(wrapper, ecdsa.toStringDer());

      expect(importButton(wrapper).attributes('disabled')).toBeDefined();
    });

    test('does not store the key when the form is submitted anyway', async () => {
      const wrapper = mountModal();
      await selectType(wrapper, 'ED25519');
      await paste(wrapper, ecdsa.toStringDer());

      await submit(wrapper);

      expect(mocks.storeExternalKeyPair).not.toHaveBeenCalled();
    });

    test('goes away once the matching type is selected', async () => {
      const wrapper = mountModal();
      await selectType(wrapper, 'ED25519');
      await paste(wrapper, ecdsa.toStringDer());

      await selectType(wrapper, 'ECDSA');

      expect(message(wrapper).exists()).toBe(false);
      expect(importButton(wrapper).attributes('disabled')).toBeUndefined();
    });
  });

  describe('the Import button', () => {
    test('is disabled until a key is entered', () => {
      const wrapper = mountModal();

      expect(importButton(wrapper).attributes('disabled')).toBeDefined();
    });

    test('shows no message while the key field is empty', async () => {
      const wrapper = mountModal();
      await selectType(wrapper, 'ED25519');

      expect(message(wrapper).exists()).toBe(false);
    });

    test('does nothing when submitted without a type', async () => {
      const wrapper = mountModal();
      await paste(wrapper, ecdsa.toStringRaw());

      await submit(wrapper);

      expect(mocks.storeExternalKeyPair).not.toHaveBeenCalled();
      expect(mocks.getPassword).not.toHaveBeenCalled();
    });
  });

  describe('importing', () => {
    test('stores a DER-encoded key with the detected type, as the raw key pair', async () => {
      const wrapper = mountModal();
      await paste(wrapper, ecdsa.toStringDer());
      await find(wrapper, 'input-private-key-nickname').setValue('My ECDSA');

      await submit(wrapper);

      expect(mocks.storeExternalKeyPair).toHaveBeenCalledWith(
        {
          nickname: 'My ECDSA',
          private_key: ecdsa.toStringRaw(),
          public_key: ecdsa.publicKey.toStringRaw(),
          index: -1,
        },
        'ECDSA',
        'pw',
      );
    });

    test('stores a raw key with the selected type', async () => {
      const wrapper = mountModal();
      await selectType(wrapper, 'ED25519');
      await paste(wrapper, ed25519.toStringRaw());

      await submit(wrapper);

      expect(mocks.storeExternalKeyPair).toHaveBeenCalledWith(
        expect.objectContaining({ public_key: ed25519.publicKey.toStringRaw() }),
        'ED25519',
        'pw',
      );
    });

    test('trims whitespace around the pasted key', async () => {
      const wrapper = mountModal();
      await selectType(wrapper, 'ED25519');
      await paste(wrapper, `  ${ed25519.toStringRaw()}\n`);

      await submit(wrapper);

      expect(mocks.storeExternalKeyPair).toHaveBeenCalledWith(
        expect.objectContaining({ private_key: ed25519.toStringRaw() }),
        'ED25519',
        'pw',
      );
    });

    test('closes and reports success', async () => {
      const wrapper = mountModal();
      await paste(wrapper, ed25519.toStringDer());

      await submit(wrapper);

      expect(wrapper.emitted('update:show')).toEqual([[false]]);
      expect(mocks.toastSuccess).toHaveBeenCalledWith('ED25519 private key imported successfully');
    });

    test('does not store anything while waiting for the application password', async () => {
      mocks.getPassword.mockReturnValue(false);
      const wrapper = mountModal();
      await paste(wrapper, ed25519.toStringDer());

      await submit(wrapper);

      expect(mocks.storeExternalKeyPair).not.toHaveBeenCalled();
      expect(wrapper.emitted('update:show')).toBeUndefined();
    });

    test('keeps the modal open and reports the error when storing fails', async () => {
      mocks.storeExternalKeyPair.mockRejectedValue(new Error('Key pair already exists'));
      const wrapper = mountModal();
      await paste(wrapper, ed25519.toStringDer());

      await submit(wrapper);

      expect(mocks.toastError).toHaveBeenCalledWith('Key pair already exists');
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
      expect(wrapper.emitted('update:show')).toBeUndefined();
    });

    test('reports an invalid key without storing it', async () => {
      const wrapper = mountModal();
      await selectType(wrapper, 'ED25519');
      await paste(wrapper, 'not a key');

      await submit(wrapper);

      expect(mocks.storeExternalKeyPair).not.toHaveBeenCalled();
      expect(mocks.toastError).toHaveBeenCalledWith('Invalid ED25519 Private key');
    });
  });

  describe('restoring the key of a known public key', () => {
    const props = () => ({ keyType: 'ED25519', publicKey: ed25519.publicKey.toStringRaw() });

    test('shows the public key being restored', () => {
      const wrapper = mountModal(props());

      expect(find(wrapper, 'label-public-key').text()).toBe(ed25519.publicKey.toStringRaw());
    });

    test('stores the key with the known type, even for a raw key', async () => {
      const wrapper = mountModal(props());
      await paste(wrapper, ed25519.toStringRaw());

      await submit(wrapper);

      expect(mocks.storeExternalKeyPair).toHaveBeenCalledWith(
        expect.objectContaining({ public_key: ed25519.publicKey.toStringRaw() }),
        'ED25519',
        'pw',
      );
    });

    test('rejects a private key that does not belong to the public key', async () => {
      const wrapper = mountModal(props());
      await paste(wrapper, PrivateKey.generateED25519().toStringRaw());

      await submit(wrapper);

      expect(mocks.storeExternalKeyPair).not.toHaveBeenCalled();
      expect(mocks.toastError).toHaveBeenCalledWith(
        'The private key does not match the public key',
      );
    });

    test('shows no type message', async () => {
      const wrapper = mountModal(props());

      await paste(wrapper, ed25519.toStringRaw());

      expect(message(wrapper).exists()).toBe(false);
    });
  });

  describe('resetting', () => {
    test('clears the key, nickname and type when the modal is opened again', async () => {
      const wrapper = mountModal();
      await paste(wrapper, ecdsa.toStringDer());
      await find(wrapper, 'input-private-key-nickname').setValue('Old');

      await wrapper.setProps({ show: false });
      await wrapper.setProps({ show: true });

      expect((find(wrapper, 'input-private-key').element as HTMLInputElement).value).toBe('');
      expect((find(wrapper, 'input-private-key-nickname').element as HTMLInputElement).value).toBe(
        '',
      );
      expect(toggleText(wrapper)).toBe('Select key type');
    });
  });

  describe('logging', () => {
    test('logs a successful import with the public key and type', async () => {
      const wrapper = mountModal();
      await paste(wrapper, ecdsa.toStringDer());

      await submit(wrapper);

      expect(mocks.logger.info).toHaveBeenCalledWith('Private key imported', {
        keyType: 'ECDSA',
        publicKey: ecdsa.publicKey.toStringRaw(),
        keyTypeWasSelected: false,
        restoringKnownPublicKey: false,
      });
    });

    test('records that the user chose the type themselves', async () => {
      const wrapper = mountModal();
      await selectType(wrapper, 'ED25519');
      await paste(wrapper, ed25519.toStringRaw());

      await submit(wrapper);

      expect(mocks.logger.info).toHaveBeenCalledWith(
        'Private key imported',
        expect.objectContaining({ keyTypeWasSelected: true }),
      );
    });

    test('logs a failed import with the error', async () => {
      const failure = new Error('Key pair already exists');
      mocks.storeExternalKeyPair.mockRejectedValue(failure);
      const wrapper = mountModal();
      await paste(wrapper, ed25519.toStringDer());

      await submit(wrapper);

      expect(mocks.logger.error).toHaveBeenCalledWith('Failed to import private key', {
        keyType: 'ED25519',
        restoringKnownPublicKey: false,
        error: failure,
      });
    });

    test('logs a public key mismatch when restoring', async () => {
      const wrapper = mountModal({
        keyType: 'ED25519',
        publicKey: ed25519.publicKey.toStringRaw(),
      });
      await paste(wrapper, PrivateKey.generateED25519().toStringRaw());

      await submit(wrapper);

      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Failed to import private key',
        expect.objectContaining({ restoringKnownPublicKey: true }),
      );
    });

    test('never logs the private key, in any encoding', async () => {
      const wrapper = mountModal();
      await paste(wrapper, ecdsa.toStringDer());
      await submit(wrapper);
      mocks.storeExternalKeyPair.mockRejectedValue(new Error('boom'));
      await submit(wrapper);

      const logged = JSON.stringify([
        ...mocks.logger.info.mock.calls,
        ...mocks.logger.error.mock.calls,
      ]);
      expect(logged).not.toContain(ecdsa.toStringRaw());
      expect(logged).not.toContain(ecdsa.toStringDer());
    });
  });
});
