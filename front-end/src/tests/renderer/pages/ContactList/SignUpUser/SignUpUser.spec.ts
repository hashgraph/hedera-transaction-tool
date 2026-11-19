// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import SignUpUser from '@renderer/pages/ContactList/SignUpUser/SignUpUser.vue';

const logger = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  addContact: vi.fn(),
  routerBack: vi.fn(),
  routerPush: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  contactsFetch: vi.fn(),
  userStore: {
    personal: { id: 'local-user-id' },
    selectedOrganization: {
      admin: true,
      serverUrl: 'https://org.example.com',
      userId: 1,
      id: 7,
    },
  },
}));

vi.mock('@renderer/utils/logger', () => ({ createLogger: () => logger }));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ back: mocks.routerBack, push: mocks.routerPush })),
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: vi.fn(() => mocks.userStore) }));
vi.mock('@renderer/stores/storeContacts', () => ({
  default: vi.fn(() => ({ fetch: mocks.contactsFetch })),
}));
vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));
vi.mock('@renderer/services/organization', () => ({ signUp: mocks.signUp }));
vi.mock('@renderer/services/contactsService', () => ({ addContact: mocks.addContact }));
vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: vi.fn(() => ({ success: mocks.toastSuccess, error: mocks.toastError })) },
}));
vi.mock('@renderer/utils', () => ({
  isLoggedInOrganization: (org: unknown) => org !== null && org !== undefined,
  isUserLoggedIn: (user: unknown) => user !== null && user !== undefined,
  isEmail: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  assertUserLoggedIn: vi.fn(),
  assertIsLoggedInOrganization: vi.fn(),
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

const stubs = {
  AppButton: {
    props: ['disabled', 'loading', 'loadingText'],
    template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
  },
  AppTextArea: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<textarea v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
};

const mountComponent = () => mount(SignUpUser, { global: { stubs } });

describe('SignUpUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.contactsFetch.mockResolvedValue(undefined);
    mocks.addContact.mockResolvedValue(undefined);
  });

  describe('single email mode', () => {
    test('signs up a user successfully and shows a success toast', async () => {
      mocks.signUp.mockResolvedValueOnce({ id: 99, email: 'new.user@example.com', createdAt: 'now' });

      const wrapper = mountComponent();
      await wrapper.find('[data-testid="input-new-user-email"]').setValue('new.user@example.com');
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(mocks.signUp).toHaveBeenCalledWith('https://org.example.com', 'new.user@example.com');
      expect(mocks.toastSuccess).toHaveBeenCalledWith('User signed up successfully');
      expect(mocks.toastError).not.toHaveBeenCalled();
      expect(mocks.addContact).not.toHaveBeenCalled();
      expect(mocks.routerBack).toHaveBeenCalled();
    });

    test('adds a contact with the nickname when one is provided', async () => {
      mocks.signUp.mockResolvedValueOnce({ id: 99, email: 'new.user@example.com', createdAt: 'now' });

      const wrapper = mountComponent();
      await wrapper.find('[data-testid="input-new-user-email"]').setValue('new.user@example.com');
      const inputs = wrapper.findAll('input');
      const nicknameInput = inputs[inputs.length - 1];
      await nicknameInput.setValue('Nick');
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(mocks.addContact).toHaveBeenCalledWith({
        user_id: 'local-user-id',
        organization_id: 7,
        organization_user_id: 99,
        organization_user_id_owner: 1,
        nickname: 'Nick',
      });
      expect(mocks.contactsFetch).toHaveBeenCalled();
    });

    test('shows the "Email already exists" toast when signUp rejects with that message', async () => {
      const error = new Error('Email already exists');
      mocks.signUp.mockRejectedValueOnce(error);

      const wrapper = mountComponent();
      await wrapper.find('[data-testid="input-new-user-email"]').setValue('taken@example.com');
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(mocks.toastError).toHaveBeenCalledWith('Email already exists');
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Failed to sign up user', { error });
    });

    test('falls back to the generic message when the rejection has no message', async () => {
      mocks.signUp.mockRejectedValueOnce('not an Error instance');

      const wrapper = mountComponent();
      await wrapper.find('[data-testid="input-new-user-email"]').setValue('new.user@example.com');
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(mocks.toastError).toHaveBeenCalledWith('Failed to sign up user');
    });
  });

  describe('multiple emails mode', () => {
    const enableMultipleMode = async wrapper => {
      await wrapper.find('[data-testid="switch-multiple-emails-mode"]').setValue(true);
    };

    test('rejects the submission when any email is invalid', async () => {
      const wrapper = mountComponent();
      await enableMultipleMode(wrapper);
      await wrapper
        .find('[data-testid="textarea-multiple-emails"]')
        .setValue('good@example.com, not-an-email');
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(mocks.signUp).not.toHaveBeenCalled();
      expect(mocks.toastError).toHaveBeenCalledWith('Invalid emails: not-an-email');
    });

    test('signs up all valid emails successfully', async () => {
      mocks.signUp.mockResolvedValue({ id: 1, email: 'x@example.com', createdAt: 'now' });

      const wrapper = mountComponent();
      await enableMultipleMode(wrapper);
      await wrapper
        .find('[data-testid="textarea-multiple-emails"]')
        .setValue('a@example.com, b@example.com');
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(mocks.signUp).toHaveBeenCalledTimes(2);
      expect(mocks.toastSuccess).toHaveBeenCalledWith('All users signed up successfully');
      expect(mocks.toastError).not.toHaveBeenCalled();
    });

    test('reports the emails that failed to sign up', async () => {
      mocks.signUp
        .mockResolvedValueOnce({ id: 1, email: 'a@example.com', createdAt: 'now' })
        .mockRejectedValueOnce(new Error('Email already exists'));

      const wrapper = mountComponent();
      await enableMultipleMode(wrapper);
      await wrapper
        .find('[data-testid="textarea-multiple-emails"]')
        .setValue('a@example.com, taken@example.com');
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(mocks.toastError).toHaveBeenCalledWith(
        'Failed to sign up users with emails: taken@example.com',
      );
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
    });
  });
});
