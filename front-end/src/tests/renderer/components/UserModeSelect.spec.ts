// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

import UserModeSelect from '@renderer/components/UserModeSelect.vue';

const makeOrg = (overrides: Record<string, unknown> = {}) => ({
  id: 'org-1',
  nickname: 'Acme Corp',
  serverUrl: 'https://acme.example',
  key: 'org-key',
  isLoading: false,
  isServerActive: true,
  loginRequired: false,
  email: 'user@acme.example',
  ...overrides,
});

const mocks = vi.hoisted(() => ({
  userStore: {
    personal: { id: 'local-user-id', useKeychain: false, email: 'local@example.com' } as null | {
      id: string,
      useKeychain: boolean,
      email?: string
    },
    selectedOrganization: null as Record<string, unknown> | null,
    organizations: [] as Record<string, unknown>[],
    selectOrganization: vi.fn(),
    refetchOrganizations: vi.fn(),
  },
  isOrganizationActive: vi.fn((org: unknown) => org !== null),
  isUserLoggedIn: vi.fn((user: unknown) => user !== null),
  redirectIfRequiredKeysToMigrate: vi.fn(),
  setLast: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/composables/useLoader', () => ({
  default: vi.fn(() => async (callback: () => Promise<void>) => callback()),
}));

vi.mock('@renderer/composables/useRecoveryPhraseHashMigrate', () => ({
  default: vi.fn(() => ({
    redirectIfRequiredKeysToMigrate: mocks.redirectIfRequiredKeysToMigrate,
  })),
}));

vi.mock('@renderer/composables/user/useDefaultOrganization', () => ({
  default: vi.fn(() => ({
    setLast: mocks.setLast,
  })),
}));

vi.mock('@renderer/utils', () => ({
  isOrganizationActive: mocks.isOrganizationActive,
  isUserLoggedIn: mocks.isUserLoggedIn,
}));

const stubs = {
  AppButton: {
    props: ['color', 'size'],
    template: '<button v-bind="$attrs"><slot /></button>',
  },
  AddOrganizationModal: {
    props: ['show'],
    emits: ['update:show', 'added'],
    template: '<div />',
  },
};

function mountSelect() {
  return mount(UserModeSelect, { global: { stubs } });
}

describe('UserModeSelect.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userStore.personal = { id: 'local-user-id', useKeychain: false, email: 'local@example.com' };
    mocks.userStore.selectedOrganization = null;
    mocks.userStore.organizations = [];
    mocks.isOrganizationActive.mockImplementation((org: unknown) => org !== null);
    mocks.isUserLoggedIn.mockImplementation((user: unknown) => user !== null);
  });

  describe('dropdown button label (dropDownValue)', () => {
    test('shows "Personal" when no org is selected', () => {
      const wrapper = mountSelect();

      expect(wrapper.find('[data-testid="dropdown-selected-mode"]').text()).toBe('Personal');
    });

    test('shows org nickname from organizations list when an org is selected', () => {
      const org = makeOrg({ nickname: 'Acme Corp' });
      mocks.userStore.selectedOrganization = org;
      mocks.userStore.organizations = [org];

      const wrapper = mountSelect();

      expect(wrapper.find('[data-testid="dropdown-selected-mode"]').text()).toBe('Acme Corp');
    });

    test('reflects updated nickname from organizations list (not stale selectedOrganization)', () => {
      const org = makeOrg({ nickname: 'Old Name' });
      mocks.userStore.selectedOrganization = { ...org, nickname: 'Old Name' };
      mocks.userStore.organizations = [{ ...org, nickname: 'New Name' }];

      const wrapper = mountSelect();

      expect(wrapper.find('[data-testid="dropdown-selected-mode"]').text()).toBe('New Name');
    });
  });

  describe('Local section', () => {
    test('always renders the Local section header', () => {
      const wrapper = mountSelect();

      expect(wrapper.text()).toContain('Local');
    });

    test('shows personal email in personal item for non-keychain user', () => {
      const wrapper = mountSelect();

      expect(wrapper.find('[data-testid="dropdown-item-0"]').text()).toContain('local@example.com');
    });

    test('shows "Personal" text in personal item for keychain user', () => {
      mocks.userStore.personal = { id: 'local-user-id', useKeychain: true };
      mocks.isUserLoggedIn.mockReturnValue(true);

      const wrapper = mountSelect();

      expect(wrapper.find('[data-testid="dropdown-item-0"]').text()).toBe('Personal');
    });

    test('personal item has active class when personal mode is selected', () => {
      mocks.userStore.selectedOrganization = null;

      const wrapper = mountSelect();

      expect(wrapper.find('[data-testid="dropdown-item-0"]').classes()).toContain('active');
    });

    test('personal item does not have active class when an org is selected', async () => {
      const org = makeOrg();
      mocks.userStore.selectedOrganization = org;
      mocks.userStore.organizations = [org];

      const wrapper = mountSelect();
      await flushPromises();

      expect(wrapper.find('[data-testid="dropdown-item-0"]').classes()).not.toContain('active');
    });
  });

  describe('Organizations section', () => {
    test('hides org section when there are no organizations', () => {
      mocks.userStore.organizations = [];

      const wrapper = mountSelect();

      expect(wrapper.text()).not.toContain('Organizations');
      expect(wrapper.find('[data-testid="dropdown-item-1"]').exists()).toBe(false);
    });

    test('shows org section header and divider when organizations exist', () => {
      mocks.userStore.organizations = [makeOrg()];

      const wrapper = mountSelect();

      expect(wrapper.text()).toContain('Organizations');
      expect(wrapper.find('.dropdown-divider').exists()).toBe(true);
    });

    test('renders an item for each organization', () => {
      mocks.userStore.organizations = [
        makeOrg({ id: 'org-1', nickname: 'Acme' }),
        makeOrg({ id: 'org-2', nickname: 'Globex' }),
      ];

      const wrapper = mountSelect();

      expect(wrapper.find('[data-testid="dropdown-item-1"]').text()).toContain('Acme');
      expect(wrapper.find('[data-testid="dropdown-item-2"]').text()).toContain('Globex');
    });

    test('shows email subtitle when org is loaded and active', () => {
      mocks.userStore.organizations = [makeOrg({ email: 'user@acme.example' })];

      const wrapper = mountSelect();

      expect(wrapper.find('[data-testid="dropdown-item-1"]').text()).toContain('user@acme.example');
    });

    test('hides email subtitle when org is still loading', () => {
      mocks.userStore.organizations = [makeOrg({ isLoading: true })];

      const wrapper = mountSelect();

      expect(wrapper.find('[data-testid="dropdown-item-1"]').text()).not.toContain('user@acme.example');
    });

    test('hides email subtitle when loginRequired is true', () => {
      mocks.userStore.organizations = [makeOrg({ loginRequired: true })];

      const wrapper = mountSelect();

      expect(wrapper.find('[data-testid="dropdown-item-1"]').text()).not.toContain('user@acme.example');
    });

    test('shows loading spinner when org isLoading', () => {
      mocks.userStore.organizations = [makeOrg({ isLoading: true })];

      const wrapper = mountSelect();

      expect(wrapper.find('[data-testid="dropdown-item-1"]').find('.spinner-border').exists()).toBe(true);
    });

    test('org item has active class when that org is selected', async () => {
      const org = makeOrg({ id: 'org-1' });
      mocks.userStore.selectedOrganization = org;
      mocks.userStore.organizations = [org];

      const wrapper = mountSelect();
      await flushPromises();

      expect(wrapper.find('[data-testid="dropdown-item-1"]').classes()).toContain('active');
    });

    test('org item does not have active class when a different org is selected', async () => {
      const org1 = makeOrg({ id: 'org-1' });
      const org2 = makeOrg({ id: 'org-2' });
      mocks.userStore.selectedOrganization = org1;
      mocks.userStore.organizations = [org1, org2];

      const wrapper = mountSelect();
      await flushPromises();

      expect(wrapper.find('[data-testid="dropdown-item-2"]').classes()).not.toContain('active');
    });
  });

  describe('mode switching', () => {
    test('does not call selectOrganization when clicking the already-selected personal item', async () => {
      mocks.userStore.selectedOrganization = null;

      const wrapper = mountSelect();
      await wrapper.find('[data-testid="dropdown-item-0"]').trigger('click');
      await flushPromises();

      expect(mocks.userStore.selectOrganization).not.toHaveBeenCalled();
    });

    test('does not call selectOrganization when clicking the already-selected org item', async () => {
      const org = makeOrg({ id: 'org-1' });
      mocks.userStore.selectedOrganization = org;
      mocks.userStore.organizations = [org];

      const wrapper = mountSelect();
      await wrapper.find('[data-testid="dropdown-item-1"]').trigger('click');
      await flushPromises();

      expect(mocks.userStore.selectOrganization).not.toHaveBeenCalled();
    });

    test('switches to personal by calling selectOrganization(null)', async () => {
      const org = makeOrg({ id: 'org-1' });
      mocks.userStore.selectedOrganization = org;
      mocks.userStore.organizations = [org];

      const wrapper = mountSelect();
      await wrapper.find('[data-testid="dropdown-item-0"]').trigger('click');
      await flushPromises();

      expect(mocks.userStore.selectOrganization).toHaveBeenCalledWith(null);
    });

    test('switches to an org by calling selectOrganization with the org shape', async () => {
      const org = makeOrg({ id: 'org-1', nickname: 'Acme', serverUrl: 'https://acme.example', key: 'k' });
      mocks.userStore.selectedOrganization = null;
      mocks.userStore.organizations = [org];

      const wrapper = mountSelect();
      await wrapper.find('[data-testid="dropdown-item-1"]').trigger('click');
      await flushPromises();

      expect(mocks.userStore.selectOrganization).toHaveBeenCalledWith({
        id: 'org-1',
        nickname: 'Acme',
        serverUrl: 'https://acme.example',
        key: 'k',
      });
    });
  });
});
