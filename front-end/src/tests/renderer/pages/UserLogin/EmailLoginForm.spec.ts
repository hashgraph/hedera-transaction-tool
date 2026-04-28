// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import EmailLoginForm from '@renderer/pages/UserLogin/components/EmailLoginForm.vue';
import { GLOBAL_MODAL_LOADER_KEY } from '@renderer/providers';

vi.mock('bootstrap/js/dist/tooltip', () => ({
  default: {
    getInstance: vi.fn(() => ({
      setContent: vi.fn(),
    })),
  },
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({
    login: vi.fn(),
    personal: null,
    refetchOrganizations: vi.fn(),
    secretHashes: [],
    setAccountSetupStarted: vi.fn(),
    setPassword: vi.fn(),
  })),
}));

vi.mock('@renderer/composables/useCreateTooltips', () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock('@renderer/composables/useRecoveryPhraseHashMigrate', () => ({
  default: vi.fn(() => ({
    redirectIfRequiredKeysToMigrate: vi.fn(),
  })),
}));

vi.mock('@renderer/composables/user/useSetupStores', () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock('@renderer/composables/user/useDefaultOrganization', () => ({
  default: vi.fn(() => ({
    select: vi.fn(),
  })),
}));

vi.mock('@renderer/services/userService', () => ({
  loginLocal: vi.fn(),
  registerLocal: vi.fn(),
}));

vi.mock('@renderer/services/safeStorageService', () => ({
  initializeUseKeychain: vi.fn(),
}));

vi.mock('@renderer/providers', () => ({
  GLOBAL_MODAL_LOADER_KEY: Symbol('GLOBAL_MODAL_LOADER_KEY'),
}));

vi.mock('@renderer/utils', () => ({
  getErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
  isEmail: vi.fn((value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)),
  isPasswordStrong: vi.fn((value: string) => ({
    length: value.length >= 10,
    result: value.length >= 10,
  })),
  isUserLoggedIn: vi.fn((user: unknown) => user !== null),
  redirectToPrevious: vi.fn(),
}));

describe('EmailLoginForm.vue registration mode', () => {
  function mountRegistrationForm() {
    return mount(EmailLoginForm, {
      props: {
        shouldRegister: true,
      },
      global: {
        provide: {
          [GLOBAL_MODAL_LOADER_KEY]: {
            value: {
              close: vi.fn(),
              open: vi.fn(),
            },
          },
        },
        stubs: {
          AppButton: {
            inheritAttrs: false,
            props: ['disabled'],
            template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
          },
          AppCheckBox: {
            emits: ['update:checked'],
            inheritAttrs: false,
            props: ['checked'],
            template:
              '<input v-bind="$attrs" type="checkbox" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" />',
          },
          AppInput: {
            emits: ['blur', 'update:modelValue'],
            inheritAttrs: false,
            props: ['modelValue'],
            template:
              '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\', $event)" />',
          },
          AppPasswordInput: {
            emits: ['blur', 'update:modelValue'],
            inheritAttrs: false,
            props: ['modelValue'],
            template:
              '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\', $event)" />',
          },
          ResetDataModal: {
            template: '<div />',
          },
        },
      },
    });
  }

  test('shows password strength tooltip hook and disables registration for weak password', async () => {
    const wrapper = mountRegistrationForm();

    expect(wrapper.find('[data-testid="input-password"]').attributes('data-bs-toggle')).toBe(
      'tooltip',
    );

    await wrapper.find('[data-testid="input-email"]').setValue('member@example.com');
    await wrapper.find('[data-testid="input-password"]').setValue('123456789');
    await wrapper.find('[data-testid="input-password-confirm"]').setValue('123456789');
    await wrapper.find('[data-testid="input-password"]').trigger('blur');

    expect(wrapper.find('[data-testid="invalid-text-password"]').text()).toBe('Invalid password');
    expect(wrapper.find('[data-testid="button-login"]').attributes('disabled')).toBeDefined();
  });

  test('shows invalid email and mismatched password validation', async () => {
    const wrapper = mountRegistrationForm();

    await wrapper.find('[data-testid="input-email"]').setValue('invalid-email');
    await wrapper.find('[data-testid="input-password"]').setValue('123456789a');
    await wrapper.find('[data-testid="input-password-confirm"]').setValue('123456789b');
    await wrapper.find('[data-testid="input-email"]').trigger('blur');
    await wrapper.find('[data-testid="input-password-confirm"]').trigger('blur');

    expect(wrapper.find('[data-testid="invalid-text-email"]').text()).toBe('Invalid e-mail');
    expect(wrapper.find('[data-testid="invalid-text-password-not-match"]').text()).toBe(
      'Password do not match',
    );
    expect(wrapper.find('[data-testid="button-login"]').attributes('disabled')).toBeDefined();
  });

  test('enables registration only after email and passwords are valid', async () => {
    const wrapper = mountRegistrationForm();
    const button = wrapper.find('[data-testid="button-login"]');

    expect(button.attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="input-email"]').setValue('member@example.com');
    await wrapper.find('[data-testid="input-password"]').setValue('123456789');
    await wrapper.find('[data-testid="input-password-confirm"]').setValue('123456789');
    expect(button.attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="input-password"]').setValue('123456789a');
    await wrapper.find('[data-testid="input-password-confirm"]').setValue('123456789a');
    expect(button.attributes('disabled')).toBeUndefined();
  });

  test('shows and toggles Keep me logged in checkbox during registration', async () => {
    const wrapper = mountRegistrationForm();
    const checkbox = wrapper.find('[data-testid="checkbox-remember"]');

    expect(checkbox.exists()).toBe(true);
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);

    await checkbox.setValue(true);

    expect((checkbox.element as HTMLInputElement).checked).toBe(true);
  });
});
