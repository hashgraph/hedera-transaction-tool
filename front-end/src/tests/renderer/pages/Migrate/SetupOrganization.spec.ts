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
    });
  });
});

describe('SetupOrganization.vue — routes', () => {
  const personalUser: PersonalUser = {
    personalId: 'personal-id-123',
    useKeychain: false,
    email: 'user@example.com',
    password: 'personalPassword',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.healthCheck.mockResolvedValue(undefined);
    mocks.getVersionStatusForOrg.mockReturnValue('ok');
    mocks.login.mockResolvedValue({ id: 1, jwtToken: 'jwt-token' });
  });

  const mountStep = () => mount(SetupOrganization, { props: { personalUser }, global: { stubs } });

  const fillAndSubmit = async (wrapper: ReturnType<typeof mountStep>, url = 'https://org.example.com') => {
    await wrapper.find('[data-testid="input-organization-url"]').setValue(url);
    await wrapper.find('[data-testid="input-temporary-organization-password"]').setValue('tempPass123');
    await wrapper.find('[data-testid="input-new-organization-password"]').setValue('newPass456');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
  };

  test('Skip continues without an organization and without contacting any server', async () => {
    const wrapper = mountStep();

    await wrapper.find('[data-testid="button-migration-skip-organization-setup"]').trigger('click');

    expect(wrapper.emitted('setOrganizationSetup')).toEqual([[null, null]]);
    expect(mocks.healthCheck).not.toHaveBeenCalled();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  test('Cancel stops the migration', async () => {
    const wrapper = mountStep();

    await wrapper.find('[data-testid="button-migration-cancel"]').trigger('click');

    expect(wrapper.emitted('migration:cancel')).toHaveLength(1);
    expect(wrapper.emitted('setOrganizationSetup')).toBeUndefined();
  });

  test('a successful login passes the entered setup and the jwt token to the wizard', async () => {
    const wrapper = mountStep();

    await fillAndSubmit(wrapper);

    expect(mocks.healthCheck).toHaveBeenCalledWith('https://org.example.com');
    expect(mocks.login).toHaveBeenCalledWith(
      'https://org.example.com',
      'user@example.com',
      'tempPass123',
    );
    expect(wrapper.emitted('setOrganizationSetup')).toEqual([
      [
        {
          organizationURL: 'https://org.example.com',
          organizationEmail: 'user@example.com',
          organizationNickname: 'Organization 1',
          temporaryOrganizationPassword: 'tempPass123',
          newOrganizationPassword: 'newPass456',
        },
        'jwt-token',
      ],
    ]);
  });

  test('an app version below the organization minimum blocks the setup', async () => {
    mocks.getVersionStatusForOrg.mockReturnValue('belowMinimum');
    const wrapper = mountStep();

    await fillAndSubmit(wrapper);

    expect(wrapper.text()).toContain('no longer supported by this organization');
    expect(mocks.login).not.toHaveBeenCalled();
    expect(wrapper.emitted('setOrganizationSetup')).toBeUndefined();
  });

  test('a failed login shows the error and does not continue', async () => {
    mocks.login.mockRejectedValue(new Error('Invalid credentials'));
    const wrapper = mountStep();

    await fillAndSubmit(wrapper);

    expect(wrapper.text()).toContain('Invalid credentials');
    expect(wrapper.emitted('setOrganizationSetup')).toBeUndefined();
  });

  test('retrying after a failed login does not repeat the version check for the same url', async () => {
    mocks.login.mockRejectedValueOnce(new Error('Invalid credentials'));
    const wrapper = mountStep();

    await fillAndSubmit(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.healthCheck).toHaveBeenCalledTimes(1);
    expect(mocks.login).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted('setOrganizationSetup')).toHaveLength(1);
  });

  test('required fields are validated before any request is made', async () => {
    const wrapper = mountStep();

    await wrapper.find('[data-testid="input-organization-url"]').setValue('not a url');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.healthCheck).not.toHaveBeenCalled();
    expect(wrapper.emitted('setOrganizationSetup')).toBeUndefined();
  });
});

