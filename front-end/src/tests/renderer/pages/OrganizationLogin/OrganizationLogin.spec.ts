// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

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
    refetchOrganizations: vi.fn(),
    selectOrganization: vi.fn(),
  },
  login: vi.fn(),
  addOrganizationCredentials: vi.fn(),
  toggleAuthTokenInSessionStorage: vi.fn(),
  setLast: vi.fn(),
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
    setLast: mocks.setLast,
  })),
}));

vi.mock('@renderer/services/organization', () => ({
  login: mocks.login,
}));

vi.mock('@renderer/services/organizationCredentials', () => ({
  addOrganizationCredentials: mocks.addOrganizationCredentials,
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
  toggleAuthTokenInSessionStorage: mocks.toggleAuthTokenInSessionStorage,
}));

describe('OrganizationLogin.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  test('successful login: stores credentials, writes token to session storage, then refreshes organizations', async () => {
    mocks.login.mockResolvedValueOnce({ jwtToken: 'test-jwt-token' });
    mocks.addOrganizationCredentials.mockResolvedValueOnce(undefined);
    mocks.userStore.refetchOrganizations.mockResolvedValueOnce(undefined);
    mocks.userStore.selectOrganization.mockResolvedValueOnce(undefined);

    const wrapper = mountOrganizationLogin();
    await wrapper
      .find('[data-testid="input-login-email-for-organization"]')
      .setValue('user@example.com');
    await wrapper
      .find('[data-testid="input-login-password-for-organization"]')
      .setValue('password123');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.toggleAuthTokenInSessionStorage).toHaveBeenCalledWith(
      'https://org.example.com',
      'test-jwt-token',
    );
    expect(mocks.addOrganizationCredentials).toHaveBeenCalledWith(
      'user@example.com',
      'password123',
      'org-id',
      'local-user-id',
      'test-jwt-token',
      'personal-password',
      true,
    );
    expect(mocks.userStore.refetchOrganizations).toHaveBeenCalled();
  });

  test('credentials are stored before token is written to session storage', async () => {
    const callOrder: string[] = [];
    mocks.login.mockResolvedValueOnce({ jwtToken: 'test-jwt-token' });
    mocks.toggleAuthTokenInSessionStorage.mockImplementationOnce(() => {
      callOrder.push('toggleAuthToken');
    });
    mocks.addOrganizationCredentials.mockImplementationOnce(async () => {
      callOrder.push('addCredentials');
    });
    mocks.userStore.refetchOrganizations.mockResolvedValueOnce(undefined);
    mocks.userStore.selectOrganization.mockResolvedValueOnce(undefined);

    const wrapper = mountOrganizationLogin();
    await wrapper
      .find('[data-testid="input-login-email-for-organization"]')
      .setValue('user@example.com');
    await wrapper
      .find('[data-testid="input-login-password-for-organization"]')
      .setValue('password123');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(callOrder).toEqual(['addCredentials', 'toggleAuthToken']);
  });

  test('login failure: shows error toast and marks fields invalid without calling refetchOrganizations', async () => {
    const toastError = vi.fn();
    vi.mocked(
      (await import('@renderer/utils/ToastManager')).ToastManager.inject,
    ).mockReturnValueOnce({ error: toastError, success: vi.fn() } as any);

    mocks.login.mockRejectedValueOnce(new Error('Invalid credentials'));

    const wrapper = mountOrganizationLogin();
    await wrapper
      .find('[data-testid="input-login-email-for-organization"]')
      .setValue('user@example.com');
    await wrapper
      .find('[data-testid="input-login-password-for-organization"]')
      .setValue('wrongpassword');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.userStore.refetchOrganizations).not.toHaveBeenCalled();
    expect(mocks.toggleAuthTokenInSessionStorage).not.toHaveBeenCalled();
  });
});
