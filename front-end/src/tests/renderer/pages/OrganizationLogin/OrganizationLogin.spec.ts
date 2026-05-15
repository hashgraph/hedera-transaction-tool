// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import OrganizationLogin from '@renderer/pages/OrganizationLogin/OrganizationLogin.vue';

const mocks = vi.hoisted(() => ({
  userStore: {
    personal: { id: 'local-user-id' },
    selectedOrganization: {
      id: 'org-id',
      nickname: 'Test Organization A',
      serverUrl: 'https://org.example.com',
      loginRequired: true,
    },
  },
}));

vi.mock('vue-router', () => ({
  onBeforeRouteLeave: vi.fn(),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/composables/useLoader', () => ({
  default: vi.fn(() => async (callback: () => Promise<void>) => callback()),
}));

vi.mock('@renderer/composables/usePersonalPassword', () => ({
  default: vi.fn(() => ({
    getPassword: vi.fn(() => 'personal-password'),
    passwordModalOpened: vi.fn(() => false),
  })),
}));

vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  DEFAULT_LAYOUT: 'DEFAULT_LAYOUT',
  default: vi.fn(),
}));

vi.mock('@renderer/composables/useRecoveryPhraseHashMigrate', () => ({
  default: vi.fn(() => ({
    redirectIfRequiredKeysToMigrate: vi.fn(),
  })),
}));

vi.mock('@renderer/composables/user/useDefaultOrganization', () => ({
  default: vi.fn(() => ({
    setLast: vi.fn(),
  })),
}));

vi.mock('@renderer/services/organization', () => ({
  login: vi.fn(),
}));

vi.mock('@renderer/services/organizationCredentials', () => ({
  addOrganizationCredentials: vi.fn(),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      error: vi.fn(),
      success: vi.fn(),
    })),
  },
}));

vi.mock('@renderer/utils', () => ({
  assertUserLoggedIn: vi.fn(),
  getErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
  isEmail: vi.fn((value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)),
  isLoggedOutOrganization: vi.fn(() => true),
  isOrganizationActive: vi.fn(() => false),
  redirectToPrevious: vi.fn(),
}));

describe('OrganizationLogin.vue', () => {
  beforeEach(() => {
    mocks.userStore.selectedOrganization.nickname = 'Test Organization A';
  });

  function mountOrganizationLogin() {
    return mount(OrganizationLogin, {
      global: {
        stubs: {
          AppButton: {
            props: ['disabled'],
            template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
          },
          AppInput: {
            props: ['modelValue'],
            template:
              '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          AppPasswordInput: {
            props: ['modelValue'],
            template:
              '<input v-bind="$attrs" :value="modelValue" type="password" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          ForgotPasswordModal: {
            props: ['show'],
            template: '<div v-if="show" data-testid="forgot-password-modal">Forgot password</div>',
          },
        },
      },
    });
  }

  test('shows organization nickname in the sign-in heading', () => {
    const wrapper = mountOrganizationLogin();

    expect(wrapper.text()).toContain('Sign In');
    expect(wrapper.text()).toContain('Organization Test Organization A');
  });

  test('keeps sign-in disabled until email and password are valid', async () => {
    const wrapper = mountOrganizationLogin();
    const button = wrapper.find('[data-testid="button-sign-in-organization-user"]');

    expect(button.attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="input-login-email-for-organization"]').setValue(
      'member@example.com',
    );
    expect(button.attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="input-login-password-for-organization"]').setValue(
      'password',
    );
    expect(button.attributes('disabled')).toBeUndefined();
  });

  test('invalid email format keeps the organization login form active', async () => {
    const wrapper = mountOrganizationLogin();

    await wrapper.find('[data-testid="input-login-email-for-organization"]').setValue(
      'invalid-email-format',
    );
    await wrapper.find('[data-testid="input-login-password-for-organization"]').setValue(
      'password',
    );

    expect(
      wrapper.find('[data-testid="button-sign-in-organization-user"]').attributes('disabled'),
    ).toBeDefined();
    expect(wrapper.find('[data-testid="input-login-email-for-organization"]').exists()).toBe(true);
  });

  test('opens forgot password modal from link', async () => {
    const wrapper = mountOrganizationLogin();

    await wrapper.find('.link-primary').trigger('click');

    expect(wrapper.find('[data-testid="forgot-password-modal"]').exists()).toBe(true);
  });
});
