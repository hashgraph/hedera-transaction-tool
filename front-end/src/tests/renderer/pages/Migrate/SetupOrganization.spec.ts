// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

import SetupOrganization from '@renderer/pages/Migrate/components/SetupOrganization.vue';
import type { PersonalUser } from '@renderer/pages/Migrate/components/SetupPersonal.vue';

const mocks = vi.hoisted(() => ({
  addOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
  login: vi.fn(),
  changePassword: vi.fn(),
  healthCheck: vi.fn(),
  addOrganizationCredentials: vi.fn(),
  toggleAuthTokenInSessionStorage: vi.fn(),
  getVersionStatusForOrg: vi.fn(),
}));

vi.mock('@renderer/services/organizationsService', () => ({
  addOrganization: mocks.addOrganization,
  deleteOrganization: mocks.deleteOrganization,
}));

vi.mock('@renderer/services/organization', () => ({
  login: mocks.login,
  changePassword: mocks.changePassword,
  healthCheck: mocks.healthCheck,
}));

vi.mock('@renderer/services/organizationCredentials', () => ({
  addOrganizationCredentials: mocks.addOrganizationCredentials,
}));

vi.mock('@renderer/stores/versionState', () => ({
  getVersionStatusForOrg: mocks.getVersionStatusForOrg,
}));

vi.mock('@renderer/utils', () => ({
  safeAwait: async (promise: Promise<unknown>) => {
    try {
      const data = await promise;
      return { data };
    } catch (error) {
      return { error };
    }
  },
  toggleAuthTokenInSessionStorage: mocks.toggleAuthTokenInSessionStorage,
  isPasswordStrong: vi.fn(() => ({ result: true, length: true })),
  isUrl: vi.fn((url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }),
}));

const stubs = {
  AppButton: {
    props: ['disabled', 'loading', 'loadingText'],
    template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
  },
  AppInput: {
    props: ['modelValue', 'filled'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  AppPasswordInput: {
    props: ['modelValue', 'filled'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
};

describe('SetupOrganization.vue — email field during migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.healthCheck.mockResolvedValue(undefined);
    mocks.getVersionStatusForOrg.mockReturnValue('ok');
    mocks.addOrganization.mockResolvedValue({ id: 'org-id' });
    mocks.login.mockResolvedValue({ id: 1, jwtToken: 'jwt-token' });
    mocks.changePassword.mockResolvedValue(undefined);
    mocks.addOrganizationCredentials.mockResolvedValue(undefined);
  });

  function mountSetupOrganization(personalUser: PersonalUser) {
    return mount(SetupOrganization, {
      props: { personalUser },
      global: { stubs },
    });
  }

  async function fillAndSubmit(wrapper: ReturnType<typeof mountSetupOrganization>, email: string) {
    await wrapper.find('[data-testid="input-organization-email"]').setValue(email);
    await wrapper.find('[data-testid="input-organization-url"]').setValue('https://org.example.com');
    await wrapper
      .find('[data-testid="input-temporary-organization-password"]')
      .setValue('tempPass123');
    await wrapper.find('[data-testid="input-new-organization-password"]').setValue('newPass456');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
  }

  describe('non-keychain (email/password) user', () => {
    const personalUser: PersonalUser = {
      personalId: 'personal-id-123',
      useKeychain: false,
      email: 'original@example.com',
      password: 'personalPassword',
    };

    test('email field is pre-filled with the personal user email', () => {
      const wrapper = mountSetupOrganization(personalUser);

      const emailInput = wrapper.find('[data-testid="input-organization-email"]');
      expect((emailInput.element as HTMLInputElement).value).toBe('original@example.com');
    });

    test('updated email is submitted when the user edits the pre-filled value', async () => {
      const wrapper = mountSetupOrganization(personalUser);

      await fillAndSubmit(wrapper, 'updated@example.com');

      expect(mocks.login).toHaveBeenCalledWith(
        'https://org.example.com',
        'updated@example.com',
        'tempPass123',
      );
      expect(mocks.addOrganizationCredentials).toHaveBeenCalledWith(
        'updated@example.com',
        'newPass456',
        'org-id',
        'personal-id-123',
        'jwt-token',
        'personalPassword',
        true,
      );
    });

    test('original email is not used when the user has changed it', async () => {
      const wrapper = mountSetupOrganization(personalUser);

      await fillAndSubmit(wrapper, 'updated@example.com');

      expect(mocks.login).not.toHaveBeenCalledWith(
        expect.anything(),
        'original@example.com',
        expect.anything(),
      );
    });
  });

  describe('keychain user', () => {
    const personalUser: PersonalUser = {
      personalId: 'personal-id-123',
      useKeychain: true,
      email: null,
      password: null,
    };

    test('email field is empty (not pre-filled) when using keychain auth', () => {
      const wrapper = mountSetupOrganization(personalUser);

      const emailInput = wrapper.find('[data-testid="input-organization-email"]');
      expect((emailInput.element as HTMLInputElement).value).toBe('');
    });

    test('entered organization email is used for login and credential storage', async () => {
      const wrapper = mountSetupOrganization(personalUser);

      await fillAndSubmit(wrapper, 'org@example.com');

      expect(mocks.login).toHaveBeenCalledWith(
        'https://org.example.com',
        'org@example.com',
        'tempPass123',
      );
      expect(mocks.addOrganizationCredentials).toHaveBeenCalledWith(
        'org@example.com',
        'newPass456',
        'org-id',
        'personal-id-123',
        'jwt-token',
        null,
        true,
      );
    });
  });
});
