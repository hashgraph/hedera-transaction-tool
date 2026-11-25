// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  getPassword: vi.fn(),
  storeExternalKeyPair: vi.fn(),
  generateRandomKeyPair: vi.fn(),
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
vi.mock('@renderer/services/keyPairService', () => ({
  generateRandomKeyPair: mocks.generateRandomKeyPair,
}));
vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => ({ success: mocks.toastSuccess, error: mocks.toastError }) },
}));
vi.mock('@renderer/utils/logger', () => ({ createLogger: () => mocks.logger }));
vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  assertUserLoggedIn: vi.fn(),
}));

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

const generated = {
  nickname: null,
  private_key: 'secret-private-key',
  public_key: 'the-public-key',
  index: -1,
};

// The last selected key type lives at module scope, so every test gets a fresh module
async function loadModal() {
  vi.resetModules();
  return (await import('@renderer/components/GenerateKeyModal.vue')).default;
}

async function mountModal(Modal?: Awaited<ReturnType<typeof loadModal>>, show = true) {
  const component = Modal ?? (await loadModal());
  return mount(component, { props: { show }, global: { stubs } });
}

type Wrapper = Awaited<ReturnType<typeof mountModal>>;
const find = (wrapper: Wrapper, testid: string) => wrapper.find(`[data-testid="${testid}"]`);
const toggleText = (wrapper: Wrapper) => find(wrapper, 'select-generate-key-type').text();
const selectType = (wrapper: Wrapper, type: 'ED25519' | 'ECDSA') =>
  find(wrapper, `select-item-${type}`).trigger('click');
const submit = async (wrapper: Wrapper) => {
  await wrapper.find('form').trigger('submit');
  await flushPromises();
};

describe('GenerateKeyModal.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPassword.mockReturnValue('pw');
    mocks.storeExternalKeyPair.mockResolvedValue(undefined);
    mocks.generateRandomKeyPair.mockReturnValue(generated);
  });

  describe('form', () => {
    test('defaults to ED25519', async () => {
      const wrapper = await mountModal();

      expect(toggleText(wrapper)).toBe('ED25519');
    });

    test('offers ED25519 and ECDSA', async () => {
      const wrapper = await mountModal();

      expect(find(wrapper, 'select-item-ED25519').exists()).toBe(true);
      expect(find(wrapper, 'select-item-ECDSA').exists()).toBe(true);
    });

    test('has no warning text about the key being unrecoverable', async () => {
      const wrapper = await mountModal();

      expect(wrapper.text()).not.toContain('recover');
    });

    test('renders nothing while closed', async () => {
      const wrapper = await mountModal(undefined, false);

      expect(wrapper.find('form').exists()).toBe(false);
    });
  });

  describe('generating', () => {
    test('generates a key of the selected type with the nickname and stores it', async () => {
      const wrapper = await mountModal();
      await selectType(wrapper, 'ECDSA');
      await find(wrapper, 'input-generate-key-nickname').setValue('Fresh key');

      await submit(wrapper);

      expect(mocks.generateRandomKeyPair).toHaveBeenCalledWith('ECDSA', 'Fresh key');
      expect(mocks.storeExternalKeyPair).toHaveBeenCalledWith(generated, 'ECDSA', 'pw');
    });

    test('generates an ED25519 key by default', async () => {
      const wrapper = await mountModal();

      await submit(wrapper);

      expect(mocks.generateRandomKeyPair).toHaveBeenCalledWith('ED25519', '');
      expect(mocks.storeExternalKeyPair).toHaveBeenCalledWith(generated, 'ED25519', 'pw');
    });

    test('closes and reports success', async () => {
      const wrapper = await mountModal();
      await selectType(wrapper, 'ECDSA');

      await submit(wrapper);

      expect(wrapper.emitted('update:show')).toEqual([[false]]);
      expect(mocks.toastSuccess).toHaveBeenCalledWith('ECDSA key generated successfully');
    });

    test('generates and stores nothing while waiting for the application password', async () => {
      mocks.getPassword.mockReturnValue(false);
      const wrapper = await mountModal();

      await submit(wrapper);

      expect(mocks.generateRandomKeyPair).not.toHaveBeenCalled();
      expect(mocks.storeExternalKeyPair).not.toHaveBeenCalled();
    });

    test('keeps the modal open and reports the error when storing fails', async () => {
      mocks.storeExternalKeyPair.mockRejectedValue(new Error('Key pair already exists'));
      const wrapper = await mountModal();

      await submit(wrapper);

      expect(mocks.toastError).toHaveBeenCalledWith('Key pair already exists');
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
      expect(wrapper.emitted('update:show')).toBeUndefined();
    });
  });

  describe('remembering the last selected key type (this session only)', () => {
    test('reopening the modal keeps the type that was selected', async () => {
      const wrapper = await mountModal();
      await selectType(wrapper, 'ECDSA');

      await wrapper.setProps({ show: false });
      await wrapper.setProps({ show: true });

      expect(toggleText(wrapper)).toBe('ECDSA');
    });

    test('a key can be generated several times in a row without choosing the type again', async () => {
      const wrapper = await mountModal();
      await selectType(wrapper, 'ECDSA');
      await submit(wrapper);

      await wrapper.setProps({ show: false });
      await wrapper.setProps({ show: true });
      await submit(wrapper);

      expect(mocks.generateRandomKeyPair.mock.calls.map(c => c[0])).toEqual(['ECDSA', 'ECDSA']);
    });

    test('is shared with a newly created modal in the same session', async () => {
      const Modal = await loadModal();
      const first = await mountModal(Modal);
      await selectType(first, 'ECDSA');
      first.unmount();

      const second = await mountModal(Modal);

      expect(toggleText(second)).toBe('ECDSA');
    });

    test('is not persisted: a fresh session starts with ED25519 again', async () => {
      const first = await mountModal();
      await selectType(first, 'ECDSA');
      first.unmount();

      const afterRestart = await mountModal(); // loadModal() reloads the module, like an app restart

      expect(toggleText(afterRestart)).toBe('ED25519');
    });

    test('does not touch local storage', async () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      const wrapper = await mountModal();

      await selectType(wrapper, 'ECDSA');

      expect(setItem).not.toHaveBeenCalled();
      setItem.mockRestore();
    });

    test('clears the nickname each time the modal is opened', async () => {
      const wrapper = await mountModal();
      await find(wrapper, 'input-generate-key-nickname').setValue('Old nickname');

      await wrapper.setProps({ show: false });
      await wrapper.setProps({ show: true });

      expect((find(wrapper, 'input-generate-key-nickname').element as HTMLInputElement).value).toBe(
        '',
      );
    });
  });

  describe('logging', () => {
    test('logs the generated key by its public key and type', async () => {
      const wrapper = await mountModal();
      await selectType(wrapper, 'ECDSA');

      await submit(wrapper);

      expect(mocks.logger.info).toHaveBeenCalledWith('Random key generated', {
        keyType: 'ECDSA',
        publicKey: 'the-public-key',
      });
    });

    test('logs a failure with the error', async () => {
      const failure = new Error('disk full');
      mocks.storeExternalKeyPair.mockRejectedValue(failure);
      const wrapper = await mountModal();

      await submit(wrapper);

      expect(mocks.logger.error).toHaveBeenCalledWith('Failed to generate key', {
        keyType: 'ED25519',
        error: failure,
      });
    });

    test('never logs the private key', async () => {
      const wrapper = await mountModal();
      await submit(wrapper);
      mocks.storeExternalKeyPair.mockRejectedValue(new Error('boom'));
      await submit(wrapper);

      const logged = JSON.stringify([
        ...mocks.logger.info.mock.calls,
        ...mocks.logger.error.mock.calls,
      ]);
      expect(logged).not.toContain('secret-private-key');
    });
  });
});
