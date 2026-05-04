// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import AppInfo from '@renderer/pages/Settings/components/GeneralTab/components/AppInfo.vue';
import OrganizationsTab from '@renderer/pages/Settings/components/OrganizationsTab.vue';

vi.mock('@renderer/composables/useVersionCheck', () => ({
  default: vi.fn(() => ({
    isDismissed: { value: true },
    latestVersion: { value: null },
    versionStatus: { value: 'current' },
  })),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({
    organizations: [],
    personal: { id: 'local-user-id' },
    deleteOrganization: vi.fn(),
    refetchOrganizations: vi.fn(),
    selectOrganization: vi.fn(),
  })),
}));

vi.mock('@renderer/stores/storeWebsocketConnection', () => ({
  default: vi.fn(() => ({
    disconnect: vi.fn(),
    isConnected: vi.fn(() => false),
    isLive: vi.fn(() => false),
  })),
}));

vi.mock('@renderer/stores/storeOrganizationConnection', () => ({
  default: vi.fn(() => ({
    getConnectionStatus: vi.fn(() => null),
    getDisconnectReason: vi.fn(() => null),
  })),
}));

vi.mock('@renderer/stores/versionState', () => ({
  getLatestVersionForOrg: vi.fn(() => null),
  getVersionStatusForOrg: vi.fn(() => null),
  organizationCompatibilityResults: { value: {} },
}));

vi.mock('@renderer/composables/user/useDefaultOrganization', () => ({
  default: vi.fn(() => ({
    setLast: vi.fn(),
  })),
}));

vi.mock('@renderer/services/organizationsService', () => ({
  updateOrganization: vi.fn(),
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
  isOrganizationActive: vi.fn(() => false),
  toggleAuthTokenInSessionStorage: vi.fn(),
}));

describe('settings general renderer coverage', () => {
  afterEach(() => {
    delete (window as any).electronAPI;
  });

  test('shows app version returned by Electron API', async () => {
    (window as any).electronAPI = {
      local: {
        update: {
          getVersion: vi.fn(async () => '0.29.0-test'),
        },
      },
    };

    const wrapper = mount(AppInfo);
    await flushPromises();

    expect(wrapper.find('[data-testid="app-version-value"]').text()).toBe('0.29.0-test');
  });

  test('shows organizations empty state when no organizations are connected', () => {
    const wrapper = mount(OrganizationsTab, {
      global: {
        stubs: {
          AddOrganizationModal: {
            template: '<div />',
          },
          AppButton: {
            template: '<button><slot /></button>',
          },
          ConnectionStatusBadge: {
            template: '<div />',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('There are no connected organizations.');
    expect(wrapper.text()).toContain('Connect now');
  });
});
