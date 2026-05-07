// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

import ProfileTab from '@renderer/pages/Settings/components/ProfileTab.vue';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  userStore: {
    personal: { id: 'local-user-id', useKeychain: false } as {
      id: string;
      useKeychain: boolean;
    } | null,
    selectedOrganization: null as null | {
      id: string;
      nickname: string;
      serverUrl: string;
      key: string;
    },
    logout: vi.fn(),
    refetchAccounts: vi.fn(),
    refetchKeys: vi.fn(),
    setPassword: vi.fn(),
    selectOrganization: vi.fn(),
  },
  getPassword: vi.fn(),
  passwordModalOpened: vi.fn((value: unknown) => value === false),
  changePasswordUser: vi.fn(),
  organizationChangePassword: vi.fn(),
  encryptOrganizationPassword: vi.fn(),
  updateOrganizationCredentials: vi.fn(),
  organizationLogout: vi.fn(),
  toastError: vi.fn(),
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
    getPassword: mocks.getPassword,
    passwordModalOpened: mocks.passwordModalOpened,
  })),
}));

vi.mock('@renderer/services/userService', () => ({
  changePassword: mocks.changePasswordUser,
}));

vi.mock('@renderer/services/organization/auth', () => ({
  changePassword: mocks.organizationChangePassword,
}));

vi.mock('@renderer/services/organizationCredentials', () => ({
  encryptOrganizationPassword: mocks.encryptOrganizationPassword,
  updateOrganizationCredentials: mocks.updateOrganizationCredentials,
}));

vi.mock('@renderer/services/organization', () => ({
  logout: mocks.organizationLogout,
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      error: mocks.toastError,
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

const ORG = {
  id: 'org-1',
  nickname: 'Acme',
  serverUrl: 'https://acme.example',
  key: 'org-key',
};

const STRONG_OLD = 'old-password';
const STRONG_NEW = 'new-strong-password';

const mountProfile = () => mount(ProfileTab, { global: { stubs } });

const setPasswords = async (wrapper: ReturnType<typeof mountProfile>, current: string, next: string) => {
  await wrapper.find('[data-testid="input-current-password"]').setValue(current);
  await wrapper.find('[data-testid="input-new-password"]').setValue(next);
};

const openConfirm = async (wrapper: ReturnType<typeof mountProfile>) => {
  await wrapper.find('form').trigger('submit');
};

const clickConfirm = async (wrapper: ReturnType<typeof mountProfile>) => {
  await wrapper.find('[data-testid="button-confirm-change-password"]').trigger('click');
  await flushPromises();
};

describe('settings profile coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userStore.personal = { id: 'local-user-id', useKeychain: false };
    mocks.userStore.selectedOrganization = null;
    mocks.passwordModalOpened.mockImplementation((value: unknown) => value === false);
  });

  describe('local user (no organization) flow', () => {
    test('renders password form for email/password users', () => {
      const wrapper = mountProfile();

      expect(wrapper.find('[data-testid="input-current-password"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="input-new-password"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="button-change-password"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="button-logout"]').exists()).toBe(true);
    });

    test('keeps change password disabled for weak new password', async () => {
      const wrapper = mountProfile();

      await setPasswords(wrapper, STRONG_OLD, '123456789');

      expect(
        wrapper.find('[data-testid="button-change-password"]').attributes('disabled'),
      ).toBeDefined();
    });

    test('shows invalid password inline message on blur', async () => {
      const wrapper = mountProfile();

      await wrapper.find('[data-testid="input-new-password"]').setValue('123456789');
      await wrapper.find('[data-testid="input-new-password"]').trigger('blur');

      expect(wrapper.text()).toContain('Invalid password');
    });

    test('opens confirmation modal when password form is valid', async () => {
      const wrapper = mountProfile();

      await setPasswords(wrapper, STRONG_OLD, STRONG_NEW);
      await openConfirm(wrapper);

      expect(wrapper.text()).toContain('Change Password?');
      expect(wrapper.find('[data-testid="button-confirm-change-password"]').exists()).toBe(true);
    });

    test('happy path: calls user changePassword, refetches keys, clears fields, opens success modal', async () => {
      mocks.changePasswordUser.mockResolvedValueOnce(undefined);
      mocks.userStore.refetchKeys.mockResolvedValueOnce(undefined);
      mocks.userStore.refetchAccounts.mockResolvedValueOnce(undefined);

      const wrapper = mountProfile();
      await setPasswords(wrapper, STRONG_OLD, STRONG_NEW);
      await openConfirm(wrapper);
      await clickConfirm(wrapper);

      expect(mocks.changePasswordUser).toHaveBeenCalledWith(
        'local-user-id',
        STRONG_OLD,
        STRONG_NEW,
      );
      expect(mocks.userStore.setPassword).toHaveBeenCalledWith(STRONG_NEW);
      expect(mocks.userStore.refetchKeys).toHaveBeenCalled();
      expect(mocks.userStore.refetchAccounts).toHaveBeenCalled();
      expect(
        (wrapper.find('[data-testid="input-current-password"]').element as HTMLInputElement).value,
      ).toBe('');
      expect(
        (wrapper.find('[data-testid="input-new-password"]').element as HTMLInputElement).value,
      ).toBe('');
      expect(wrapper.text()).toContain('Password Changed Successfully');
      expect(mocks.toastError).not.toHaveBeenCalled();
    });

    test('error path: surfaces toast and preserves the form when changePassword throws', async () => {
      mocks.changePasswordUser.mockRejectedValueOnce(new Error('Wrong current password'));

      const wrapper = mountProfile();
      await setPasswords(wrapper, STRONG_OLD, STRONG_NEW);
      await openConfirm(wrapper);
      await clickConfirm(wrapper);

      expect(mocks.toastError).toHaveBeenCalledWith('Wrong current password');
      expect(mocks.userStore.setPassword).not.toHaveBeenCalled();
      expect(
        (wrapper.find('[data-testid="input-current-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_OLD);
      expect(
        (wrapper.find('[data-testid="input-new-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_NEW);
      expect(wrapper.text()).not.toContain('Password Changed Successfully');
    });
  });

  describe('organization flow', () => {
    beforeEach(() => {
      mocks.userStore.selectedOrganization = { ...ORG };
    });

    test('happy path (keychain mode): encrypts first, then rotates BE, then writes encrypted blob to local DB', async () => {
      // Realistic state: keychain users have no cached personal password,
      // so getPassword returns null and the second arg to encrypt is undefined.
      mocks.userStore.personal = { id: 'local-user-id', useKeychain: true };

      const encryptedBlob = 'encrypted-blob';
      mocks.getPassword.mockReturnValueOnce(null);
      mocks.encryptOrganizationPassword.mockResolvedValueOnce(encryptedBlob);
      mocks.organizationChangePassword.mockResolvedValueOnce(undefined);
      mocks.updateOrganizationCredentials.mockResolvedValueOnce(true);

      const wrapper = mountProfile();
      await setPasswords(wrapper, STRONG_OLD, STRONG_NEW);
      await openConfirm(wrapper);
      await clickConfirm(wrapper);

      // Encrypt is called BEFORE the BE rotation, which is BEFORE the local DB write.
      const encryptOrder = mocks.encryptOrganizationPassword.mock.invocationCallOrder[0];
      const beOrder = mocks.organizationChangePassword.mock.invocationCallOrder[0];
      const dbOrder = mocks.updateOrganizationCredentials.mock.invocationCallOrder[0];
      expect(encryptOrder).toBeLessThan(beOrder);
      expect(beOrder).toBeLessThan(dbOrder);

      expect(mocks.encryptOrganizationPassword).toHaveBeenCalledWith(STRONG_NEW, undefined);
      expect(mocks.organizationChangePassword).toHaveBeenCalledWith(
        ORG.serverUrl,
        STRONG_OLD,
        STRONG_NEW,
      );
      // DB write must use the already-encrypted blob and pass passwordIsEncrypted=true.
      expect(mocks.updateOrganizationCredentials).toHaveBeenCalledWith(
        ORG.id,
        'local-user-id',
        undefined,
        encryptedBlob,
        undefined,
        undefined,
        true,
      );

      expect(wrapper.text()).toContain('Password Changed Successfully');
      expect(
        (wrapper.find('[data-testid="input-current-password"]').element as HTMLInputElement).value,
      ).toBe('');
      expect(
        (wrapper.find('[data-testid="input-new-password"]').element as HTMLInputElement).value,
      ).toBe('');
      expect(mocks.toastError).not.toHaveBeenCalled();
    });

    test('happy path (non-keychain): forwards the cached personal password as encryption key', async () => {
      mocks.userStore.personal = { id: 'local-user-id', useKeychain: false };
      mocks.getPassword.mockReturnValueOnce('cached-personal-password');
      mocks.encryptOrganizationPassword.mockResolvedValueOnce('encrypted');
      mocks.organizationChangePassword.mockResolvedValueOnce(undefined);
      mocks.updateOrganizationCredentials.mockResolvedValueOnce(true);

      const wrapper = mountProfile();
      await setPasswords(wrapper, STRONG_OLD, STRONG_NEW);
      await openConfirm(wrapper);
      await clickConfirm(wrapper);

      expect(mocks.encryptOrganizationPassword).toHaveBeenCalledWith(
        STRONG_NEW,
        'cached-personal-password',
      );
    });

    test('keychain Deny: encrypt throws -> BE never called, DB never called, fields preserved, modal stays open', async () => {
      mocks.getPassword.mockReturnValueOnce(null);
      mocks.encryptOrganizationPassword.mockRejectedValueOnce(
        new Error('Keychain access denied or unavailable'),
      );

      const wrapper = mountProfile();
      await setPasswords(wrapper, STRONG_OLD, STRONG_NEW);
      await openConfirm(wrapper);
      await clickConfirm(wrapper);

      expect(mocks.organizationChangePassword).not.toHaveBeenCalled();
      expect(mocks.updateOrganizationCredentials).not.toHaveBeenCalled();
      expect(mocks.toastError).toHaveBeenCalledWith('Keychain access denied or unavailable');

      expect(
        (wrapper.find('[data-testid="input-current-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_OLD);
      expect(
        (wrapper.find('[data-testid="input-new-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_NEW);
      expect(wrapper.text()).toContain('Change Password?');
      expect(wrapper.text()).not.toContain('Password Changed Successfully');
    });

    test('BE rotation failure after encrypt: DB never written, fields preserved', async () => {
      mocks.getPassword.mockReturnValueOnce(null);
      mocks.encryptOrganizationPassword.mockResolvedValueOnce('encrypted');
      mocks.organizationChangePassword.mockRejectedValueOnce(new Error('Invalid old password'));

      const wrapper = mountProfile();
      await setPasswords(wrapper, STRONG_OLD, STRONG_NEW);
      await openConfirm(wrapper);
      await clickConfirm(wrapper);

      expect(mocks.encryptOrganizationPassword).toHaveBeenCalled();
      expect(mocks.updateOrganizationCredentials).not.toHaveBeenCalled();
      expect(mocks.toastError).toHaveBeenCalledWith('Invalid old password');
      expect(
        (wrapper.find('[data-testid="input-current-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_OLD);
      expect(
        (wrapper.find('[data-testid="input-new-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_NEW);
    });

    test('DB write returns false -> raises domain error toast and preserves fields', async () => {
      mocks.getPassword.mockReturnValueOnce(null);
      mocks.encryptOrganizationPassword.mockResolvedValueOnce('encrypted');
      mocks.organizationChangePassword.mockResolvedValueOnce(undefined);
      mocks.updateOrganizationCredentials.mockResolvedValueOnce(false);

      const wrapper = mountProfile();
      await setPasswords(wrapper, STRONG_OLD, STRONG_NEW);
      await openConfirm(wrapper);
      await clickConfirm(wrapper);

      expect(mocks.toastError).toHaveBeenCalledWith('Failed to update organization credentials');
      expect(
        (wrapper.find('[data-testid="input-current-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_OLD);
      expect(
        (wrapper.find('[data-testid="input-new-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_NEW);
    });

    test('DB write rejects (IPC error) -> surfaces the thrown message and preserves fields', async () => {
      mocks.getPassword.mockReturnValueOnce(null);
      mocks.encryptOrganizationPassword.mockResolvedValueOnce('encrypted');
      mocks.organizationChangePassword.mockResolvedValueOnce(undefined);
      mocks.updateOrganizationCredentials.mockRejectedValueOnce(
        new Error('Failed to store organization credentials'),
      );

      const wrapper = mountProfile();
      await setPasswords(wrapper, STRONG_OLD, STRONG_NEW);
      await openConfirm(wrapper);
      await clickConfirm(wrapper);

      expect(mocks.toastError).toHaveBeenCalledWith('Failed to store organization credentials');
      expect(wrapper.text()).not.toContain('Password Changed Successfully');
      expect(
        (wrapper.find('[data-testid="input-current-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_OLD);
      expect(
        (wrapper.find('[data-testid="input-new-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_NEW);
    });

    test('personal-password modal opens (early return): no encrypt, no BE, no DB; fields stay populated for the callback', async () => {
      mocks.getPassword.mockReturnValueOnce(false);

      const wrapper = mountProfile();
      await setPasswords(wrapper, STRONG_OLD, STRONG_NEW);
      await openConfirm(wrapper);
      await clickConfirm(wrapper);

      expect(mocks.encryptOrganizationPassword).not.toHaveBeenCalled();
      expect(mocks.organizationChangePassword).not.toHaveBeenCalled();
      expect(mocks.updateOrganizationCredentials).not.toHaveBeenCalled();
      expect(mocks.toastError).not.toHaveBeenCalled();
      // Field state must survive — the personal-password modal callback re-invokes the handler and needs the values.
      expect(
        (wrapper.find('[data-testid="input-current-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_OLD);
      expect(
        (wrapper.find('[data-testid="input-new-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_NEW);
    });

    test('modal callback re-invocation: second call sees populated fields and runs the full flow', async () => {
      // First invocation: personal-password modal opens, getPassword returns false → early return.
      // Second invocation (driven by the modal's onSubmitted callback): cached password is now available.
      mocks.getPassword.mockReturnValueOnce(false).mockReturnValueOnce('entered-personal-password');
      mocks.encryptOrganizationPassword.mockResolvedValueOnce('encrypted-blob');
      mocks.organizationChangePassword.mockResolvedValueOnce(undefined);
      mocks.updateOrganizationCredentials.mockResolvedValueOnce(true);

      const wrapper = mountProfile();
      await setPasswords(wrapper, STRONG_OLD, STRONG_NEW);
      await openConfirm(wrapper);

      // First confirm click — early return path, fields must survive.
      await clickConfirm(wrapper);
      expect(mocks.encryptOrganizationPassword).not.toHaveBeenCalled();
      expect(
        (wrapper.find('[data-testid="input-current-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_OLD);
      expect(
        (wrapper.find('[data-testid="input-new-password"]').element as HTMLInputElement).value,
      ).toBe(STRONG_NEW);

      // Simulate the personal-password modal's submit callback re-entering handleChangePassword.
      // The composable's contract is that `getPassword(callback, …)` invokes `callback(password)`
      // when the modal is submitted — that callback is `handleChangePassword` itself, which we
      // trigger here by clicking confirm a second time.
      await clickConfirm(wrapper);

      expect(mocks.encryptOrganizationPassword).toHaveBeenCalledTimes(1);
      expect(mocks.encryptOrganizationPassword).toHaveBeenCalledWith(
        STRONG_NEW,
        'entered-personal-password',
      );
      expect(mocks.organizationChangePassword).toHaveBeenCalledWith(
        ORG.serverUrl,
        STRONG_OLD,
        STRONG_NEW,
      );
      expect(mocks.updateOrganizationCredentials).toHaveBeenCalledWith(
        ORG.id,
        'local-user-id',
        undefined,
        'encrypted-blob',
        undefined,
        undefined,
        true,
      );
      expect(wrapper.text()).toContain('Password Changed Successfully');
    });

    test('clicking Confirm with empty fields throws "Password cannot be empty" without side effects', async () => {
      const wrapper = mountProfile();
      await setPasswords(wrapper, STRONG_OLD, STRONG_NEW);
      await openConfirm(wrapper);

      // Simulate the legacy bug shape: fields somehow ended up empty while the confirm modal is open.
      await wrapper.find('[data-testid="input-current-password"]').setValue('');
      await wrapper.find('[data-testid="input-new-password"]').setValue('');

      await clickConfirm(wrapper);

      expect(mocks.encryptOrganizationPassword).not.toHaveBeenCalled();
      expect(mocks.organizationChangePassword).not.toHaveBeenCalled();
      expect(mocks.updateOrganizationCredentials).not.toHaveBeenCalled();
      expect(mocks.toastError).toHaveBeenCalledWith('Password cannot be empty');
    });

    test('clicking Confirm after the new password becomes invalid raises the strength error', async () => {
      const wrapper = mountProfile();
      // Open the modal with a strong new password.
      await setPasswords(wrapper, STRONG_OLD, STRONG_NEW);
      await openConfirm(wrapper);

      // Then degrade the new password to a weak one and blur to mark it invalid.
      const newPasswordInput = wrapper.find('[data-testid="input-new-password"]');
      await newPasswordInput.setValue('short');
      await newPasswordInput.trigger('blur');

      await clickConfirm(wrapper);

      expect(mocks.encryptOrganizationPassword).not.toHaveBeenCalled();
      expect(mocks.organizationChangePassword).not.toHaveBeenCalled();
      expect(mocks.updateOrganizationCredentials).not.toHaveBeenCalled();
      expect(mocks.toastError).toHaveBeenCalledWith(
        'Password must be at least 10 characters long',
      );
    });
  });

  describe('logout flow', () => {
    test('organization logout: logs out, clears local credentials, re-selects the org', async () => {
      mocks.userStore.selectedOrganization = { ...ORG };
      mocks.organizationLogout.mockResolvedValueOnce(undefined);
      mocks.updateOrganizationCredentials.mockResolvedValueOnce(true);

      const wrapper = mountProfile();
      await wrapper.find('[data-testid="button-logout"]').trigger('click');
      await flushPromises();

      expect(mocks.organizationLogout).toHaveBeenCalledWith(ORG.serverUrl);
      expect(mocks.updateOrganizationCredentials).toHaveBeenCalledWith(
        ORG.id,
        'local-user-id',
        undefined,
        '',
        null,
      );
      expect(mocks.userStore.selectOrganization).toHaveBeenCalledWith({
        id: ORG.id,
        nickname: ORG.nickname,
        serverUrl: ORG.serverUrl,
        key: ORG.key,
      });
    });

    test('local-user logout: clears HTX_USER from localStorage, calls store.logout, pushes to login route', async () => {
      mocks.userStore.selectedOrganization = null;
      const removeItemSpy = vi.spyOn(window.localStorage, 'removeItem');

      const wrapper = mountProfile();
      await wrapper.find('[data-testid="button-logout"]').trigger('click');
      await flushPromises();

      expect(removeItemSpy).toHaveBeenCalledWith('htx_user');
      expect(mocks.userStore.logout).toHaveBeenCalled();
      expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'login' });
      expect(mocks.organizationLogout).not.toHaveBeenCalled();
    });

    test('organization logout no-ops when there is no logged-in personal user', async () => {
      mocks.userStore.selectedOrganization = { ...ORG };
      mocks.userStore.personal = null;

      const wrapper = mountProfile();
      await wrapper.find('[data-testid="button-logout"]').trigger('click');
      await flushPromises();

      expect(mocks.organizationLogout).not.toHaveBeenCalled();
      expect(mocks.updateOrganizationCredentials).not.toHaveBeenCalled();
      expect(mocks.userStore.selectOrganization).not.toHaveBeenCalled();
    });
  });

  describe('keychain-only personal user (no organization)', () => {
    test('renders the Reset Application form instead of the password change form', () => {
      mocks.userStore.personal = { id: 'local-user-id', useKeychain: true };
      mocks.userStore.selectedOrganization = null;

      const wrapper = mountProfile();

      expect(wrapper.text()).toContain('Reset Application');
      expect(wrapper.find('[data-testid="input-current-password"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="input-new-password"]').exists()).toBe(false);
    });
  });
});
