// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import ProfileTab from '@renderer/pages/Settings/components/ProfileTab.vue';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  userStore: {
    personal: { id: 'local-user-id', useKeychain: false },
    selectedOrganization: null as any,
    logout: vi.fn(),
    refetchAccounts: vi.fn(),
    refetchKeys: vi.fn(),
    setPassword: vi.fn(),
  },
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: mocks.routerPush,
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
    getPassword: vi.fn(),
    passwordModalOpened: vi.fn(() => false),
  })),
}));

vi.mock('@renderer/services/userService', () => ({
  changePassword: vi.fn(),
}));

vi.mock('@renderer/services/organization/auth', () => ({
  changePassword: vi.fn(),
}));

vi.mock('@renderer/services/organizationCredentials', () => ({
  updateOrganizationCredentials: vi.fn(),
}));

vi.mock('@renderer/services/organization', () => ({
  logout: vi.fn(),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      error: vi.fn(),
    })),
  },
}));

vi.mock('@renderer/utils', () => ({
  assertUserLoggedIn: vi.fn(),
  getErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
  isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
  isPasswordStrong: vi.fn((value: string) => ({
    length: value.length >= 10,
    result: value.length >= 10,
  })),
  isUserLoggedIn: vi.fn((user: unknown) => user !== null),
  toggleAuthTokenInSessionStorage: vi.fn(),
}));

const stubs = {
  AppButton: {
    props: ['disabled', 'type'],
    template: '<button v-bind="$attrs" :disabled="disabled" :type="type"><slot /></button>',
  },
  AppCustomIcon: {
    template: '<div />',
  },
  AppModal: {
    props: ['show'],
    template: '<div v-if="show"><slot /></div>',
  },
  AppPasswordInput: {
    props: ['modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\', $event)" />',
  },
  ResetDataModal: {
    template: '<div />',
  },
};

describe('settings profile coverage', () => {
  beforeEach(() => {
    mocks.userStore.personal = { id: 'local-user-id', useKeychain: false };
    mocks.userStore.selectedOrganization = null;
  });

  test('renders password form for email/password users', () => {
    const wrapper = mount(ProfileTab, {
      global: {
        stubs,
      },
    });

    expect(wrapper.find('[data-testid="input-current-password"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="input-new-password"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="button-change-password"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="button-logout"]').exists()).toBe(true);
  });

  test('keeps change password disabled for weak new password', async () => {
    const wrapper = mount(ProfileTab, {
      global: {
        stubs,
      },
    });

    await wrapper.find('[data-testid="input-current-password"]').setValue('current-password');
    await wrapper.find('[data-testid="input-new-password"]').setValue('123456789');

    expect(wrapper.find('[data-testid="button-change-password"]').attributes('disabled')).toBeDefined();
  });

  test('shows invalid password inline message on blur', async () => {
    const wrapper = mount(ProfileTab, {
      global: {
        stubs,
      },
    });

    await wrapper.find('[data-testid="input-new-password"]').setValue('123456789');
    await wrapper.find('[data-testid="input-new-password"]').trigger('blur');

    expect(wrapper.text()).toContain('Invalid password');
  });

  test('opens confirmation modal when password form is valid', async () => {
    const wrapper = mount(ProfileTab, {
      global: {
        stubs,
      },
    });

    await wrapper.find('[data-testid="input-current-password"]').setValue('current-password');
    await wrapper.find('[data-testid="input-new-password"]').setValue('new-password');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.text()).toContain('Change Password?');
    expect(wrapper.find('[data-testid="button-confirm-change-password"]').exists()).toBe(true);
  });
});
