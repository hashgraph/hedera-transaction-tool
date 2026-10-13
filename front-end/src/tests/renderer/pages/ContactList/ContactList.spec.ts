// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import ContactList from '@renderer/pages/ContactList/ContactList.vue';

const mocks = vi.hoisted(() => ({
  accountsGetAll: vi.fn().mockResolvedValue([]),
  routerPush: vi.fn(),
  userStore: {
    personal: { id: 'local-user-id' },
    selectedOrganization: {
      admin: false,
      serverUrl: 'https://org.example.com',
      userId: 1,
    },
  },
  contactsStore: {
    contacts: [] as any[],
    fetching: false,
    fetch: vi.fn(),
  },
  notificationsStore: {
    notifications: {} as Record<string, any[]>,
  },
  setCanViewReports: vi.fn().mockResolvedValue(undefined),
  toastSuccess: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({
    network: 'testnet',
  })),
}));

vi.mock('@renderer/stores/storeContacts', () => ({
  default: vi.fn(() => mocks.contactsStore),
}));

vi.mock('@renderer/stores/storeNotifications', () => ({
  default: vi.fn(() => mocks.notificationsStore),
}));

vi.mock('@renderer/composables/useRedirectOnOnlyOrganization', () => ({
  default: vi.fn(),
}));

vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));

vi.mock('@renderer/composables/useMarkNotifications', () => ({
  default: vi.fn(() => ({
    oldNotifications: { value: [] },
  })),
}));

vi.mock('@renderer/services/accountsService', () => ({
  getAll: mocks.accountsGetAll,
}));

vi.mock('@renderer/services/organization', () => ({
  deleteUser: vi.fn(),
  elevateUserToAdmin: vi.fn(),
  setCanViewReports: mocks.setCanViewReports,
}));

vi.mock('@renderer/services/contactsService', () => ({
  removeContact: vi.fn(),
}));

vi.mock('@renderer/utils', () => ({
  assertIsLoggedInOrganization: vi.fn(),
  assertUserLoggedIn: vi.fn(),
  isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
  isUserLoggedIn: vi.fn((user: unknown) => user !== null),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      success: mocks.toastSuccess,
    })),
  },
}));

describe('ContactList.vue', () => {
  beforeEach(() => {
    mocks.routerPush.mockReset();
    mocks.accountsGetAll.mockResolvedValue([]);
    mocks.userStore.selectedOrganization = {
      admin: false,
      serverUrl: 'https://org.example.com',
      userId: 1,
    };
    mocks.contactsStore.contacts = [];
    mocks.contactsStore.fetching = false;
    mocks.contactsStore.fetch.mockReset();
    mocks.notificationsStore.notifications = {};
    mocks.setCanViewReports.mockClear();
    mocks.toastSuccess.mockClear();
  });

  function mountContactList() {
    return mount(ContactList, {
      global: {
        mocks: {
          $router: {
            push: mocks.routerPush,
          },
        },
        stubs: {
          AppButton: {
            props: ['disabled'],
            template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
          },
          AppLoader: {
            template: '<div />',
          },
          ContactDetails: {
            props: ['contact'],
            template:
              '<div data-testid="stub-contact-details">{{ contact.user.email }}' +
              '<button data-testid="btn-toggle-view-reports" @click="$emit(\'toggle-view-reports\')" /></div>',
          },
          DeleteContactModal: {
            template: '<div />',
          },
          ElevateContactModal: {
            template: '<div />',
          },
          Transition: false,
        },
      },
    });
  }

  test('shows the empty contacts message when the contacts store has no contacts', async () => {
    const wrapper = mountContactList();

    const emptyState = wrapper.find('[data-testid="p-no-contacts-found"]');

    expect(emptyState.exists()).toBe(true);
    expect(emptyState.text()).toBe('No contacts found');
    expect(wrapper.findAll('[data-testid^="p-contact-email-"]')).toHaveLength(0);
  });

  test('filters contacts without keys for non-admin users', () => {
    mocks.contactsStore.contacts = [
      {
        user: { id: 1, email: 'with-key@example.com', admin: false, status: 'ACTIVE' },
        userKeys: [{ id: 1, publicKey: 'key-1' }],
        nickname: '',
        nicknameId: null,
      },
      {
        user: { id: 2, email: 'without-key@example.com', admin: false, status: 'ACTIVE' },
        userKeys: [],
        nickname: '',
        nicknameId: null,
      },
    ];

    const wrapper = mountContactList();

    expect(wrapper.find('[data-testid="button-add-new-contact"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="p-contact-email-with-key@example.com"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="p-contact-email-without-key@example.com"]').exists()).toBe(
      false,
    );
  });

  test('shows admin-only add button and all contacts for admins', () => {
    mocks.userStore.selectedOrganization.admin = true;
    mocks.contactsStore.contacts = [
      {
        user: { id: 1, email: 'with-key@example.com', admin: false, status: 'ACTIVE' },
        userKeys: [{ id: 1, publicKey: 'key-1' }],
        nickname: '',
        nicknameId: null,
      },
      {
        user: { id: 2, email: 'without-key@example.com', admin: false, status: 'ACTIVE' },
        userKeys: [],
        nickname: '',
        nicknameId: null,
      },
    ];

    const wrapper = mountContactList();

    expect(wrapper.find('[data-testid="button-add-new-contact"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="p-contact-email-with-key@example.com"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="p-contact-email-without-key@example.com"]').exists()).toBe(
      true,
    );
  });

  test('shows registered, admin, and update-available indicators', () => {
    mocks.userStore.selectedOrganization.admin = true;
    mocks.contactsStore.contacts = [
      {
        user: {
          id: 1,
          email: 'new-admin@example.com',
          admin: true,
          status: 'NEW',
          updateAvailable: true,
        },
        userKeys: [{ id: 1, publicKey: 'key-1' }],
        nickname: '',
        nicknameId: null,
      },
    ];
    mocks.notificationsStore.notifications = {
      'https://org.example.com': [
        {
          notification: {
            type: 'USER_REGISTERED',
            entityId: 1,
          },
        },
      ],
    };

    const wrapper = mountContactList();

    expect(
      wrapper.find('[data-testid="span-contact-notification-indicator-new-admin@example.com"]')
        .exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain('admin');
    expect(wrapper.text()).toContain('new');
    expect(wrapper.text()).toContain('update available');
  });

  test('routes admins to contact creation when Add New is clicked', async () => {
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountContactList();
    await wrapper.find('[data-testid="button-add-new-contact"]').trigger('click');
    await nextTick();

    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'signUpUser' });
  });

  describe('toggling report API access off', () => {
    beforeEach(() => {
      mocks.userStore.selectedOrganization.admin = true;
      mocks.contactsStore.contacts = [
        {
          user: {
            id: 1,
            email: 'with-key@example.com',
            admin: false,
            status: 'ACTIVE',
            canViewReports: true,
            apiKeyStatus: { hasKey: true },
          },
          userKeys: [{ id: 1, publicKey: 'key-1' }],
          nickname: '',
          nicknameId: null,
        },
      ];
    });

    test('shows the revoke confirmation prompt when the contact has an API key', async () => {
      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await nextTick();

      const modal = wrapper.find('[data-testid="modal-confirm-transaction"]');
      expect(modal.attributes('style')).toContain('display: block');
      expect(mocks.setCanViewReports).not.toHaveBeenCalled();
    });

    test('does not revoke access if the confirmation prompt is declined', async () => {
      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await nextTick();
      const cancelButton = wrapper.findAll('button').find(btn => btn.text() === 'Cancel');
      await cancelButton?.trigger('click');
      await nextTick();

      const modal = wrapper.find('[data-testid="modal-confirm-transaction"]');
      expect(modal.attributes('style')).toContain('display: none');
      expect(mocks.setCanViewReports).not.toHaveBeenCalled();
    });

    test('revokes access once the confirmation prompt is accepted', async () => {
      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await nextTick();
      await wrapper.find('[data-testid="button-confirm-revoke-view-reports"]').trigger('click');
      await nextTick();

      expect(mocks.setCanViewReports).toHaveBeenCalledWith(
        'https://org.example.com',
        1,
        false,
      );
    });

    test('shows a success toast and refetches contacts once access is revoked', async () => {
      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await nextTick();
      await wrapper.find('[data-testid="button-confirm-revoke-view-reports"]').trigger('click');
      await flushPromises();

      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        'Report access revoked successfully',
        'view-reports-access-1',
      );
      expect(mocks.contactsStore.fetch).toHaveBeenCalled();
    });

    test('skips the confirmation prompt when the contact has no API key', async () => {
      mocks.contactsStore.contacts[0].user.apiKeyStatus = { hasKey: false };

      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await nextTick();

      const modal = wrapper.find('[data-testid="modal-confirm-transaction"]');
      expect(modal.attributes('style')).toContain('display: none');
      expect(mocks.setCanViewReports).toHaveBeenCalledWith(
        'https://org.example.com',
        1,
        false,
      );
    });

    test('skips the confirmation prompt when the existing key is already revoked', async () => {
      mocks.contactsStore.contacts[0].user.apiKeyStatus = {
        hasKey: true,
        revokedAt: '2026-01-01T00:00:00.000Z',
      };

      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await nextTick();

      const modal = wrapper.find('[data-testid="modal-confirm-transaction"]');
      expect(modal.attributes('style')).toContain('display: none');
      expect(mocks.setCanViewReports).toHaveBeenCalledWith(
        'https://org.example.com',
        1,
        false,
      );
    });
  });

  describe('granting report API access', () => {
    beforeEach(() => {
      mocks.userStore.selectedOrganization.admin = true;
      mocks.contactsStore.contacts = [
        {
          user: {
            id: 1,
            email: 'no-access@example.com',
            admin: false,
            status: 'ACTIVE',
            canViewReports: false,
            apiKeyStatus: { hasKey: false },
          },
          userKeys: [{ id: 1, publicKey: 'key-1' }],
          nickname: '',
          nicknameId: null,
        },
      ];
    });

    test('grants access immediately without a confirmation prompt', async () => {
      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await flushPromises();

      const modal = wrapper.find('[data-testid="modal-confirm-transaction"]');
      expect(modal.attributes('style')).toContain('display: none');
      expect(mocks.setCanViewReports).toHaveBeenCalledWith(
        'https://org.example.com',
        1,
        true,
      );
    });

    test('shows a success toast and refetches contacts once access is granted', async () => {
      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await flushPromises();

      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        'Report access granted successfully',
        'view-reports-access-1',
      );
      expect(mocks.contactsStore.fetch).toHaveBeenCalled();
    });
  });
});
