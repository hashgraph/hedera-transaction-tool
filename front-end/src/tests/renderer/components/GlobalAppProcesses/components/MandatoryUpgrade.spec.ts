 // @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import MandatoryUpgrade from '@renderer/components/GlobalAppProcesses/components/MandatoryUpgrade.vue';
import {
  initialVersionCheckState,
  resetVersionState,
  setVersionDataForOrg,
} from '@renderer/stores/versionState';

const mocks = vi.hoisted(() => ({
  disconnectOrganization: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined),
  setLast: vi.fn(async () => undefined),
  startUpdate: vi.fn(),
  installUpdate: vi.fn(),
  cancelUpdate: vi.fn(),
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
  electronUpdater: {
    state: { value: 'idle' },
    progress: { value: null },
    error: { value: null },
    updateInfo: { value: { version: '2.0.0' } },
    startUpdate: vi.fn(),
    installUpdate: vi.fn(),
    cancelUpdate: vi.fn(),
  },
  userStore: {
    selectedOrganization: null as null | { id: string; serverUrl: string; nickname?: string },
    organizations: [] as Array<{ id: string; serverUrl: string; nickname?: string }>,
    personal: { isLoggedIn: true, id: 'user-1' },
    selectOrganization: vi.fn(async (org: unknown) => {
      mocks.userStore.selectedOrganization = org as any;
    }),
  },
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/composables/useElectronUpdater', () => ({
  default: vi.fn(() => mocks.electronUpdater),
}));

vi.mock('@renderer/composables/user/useDefaultOrganization', () => ({
  default: vi.fn(() => ({
    setLast: mocks.setLast,
  })),
}));

vi.mock('@renderer/services/organization/disconnect', () => ({
  disconnectOrganization: mocks.disconnectOrganization,
}));

vi.mock('@renderer/services/organization/auth', () => ({
  logout: mocks.logout,
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => mocks.toast),
  },
}));

vi.mock('@renderer/components/ui/AppModal.vue', () => ({
  default: {
    props: ['show', 'loading'],
    template: '<div v-if="show"><slot /></div>',
  },
}));

vi.mock('@renderer/components/ui/AppButton.vue', () => ({
  default: {
    template: '<button v-bind="$attrs"><slot /></button>',
  },
}));

vi.mock('@renderer/components/GlobalAppProcesses/components/CheckForUpgrade.vue', () => ({
  default: { template: '<div data-testid="checking">checking</div>' },
}));

vi.mock('@renderer/components/GlobalAppProcesses/components/DownloadUpgrade.vue', () => ({
  default: { template: '<div data-testid="downloading">downloading</div>' },
}));

vi.mock('@renderer/components/GlobalAppProcesses/components/InstallUpgrade.vue', () => ({
  default: { template: '<div data-testid="installing">installing</div>' },
}));

vi.mock('@renderer/components/GlobalAppProcesses/components/UpgradeError.vue', () => ({
  default: { template: '<div data-testid="upgrade-error">error</div>' },
}));

vi.mock('@renderer/components/Organization/CompatibilityWarningModal.vue', () => ({
  default: {
    props: [
      'show',
      'title',
      'summaryText',
      'warningText',
      'conflicts',
      'conflictsTitle',
      'cancelLabel',
      'proceedLabel',
    ],
    emits: ['proceed', 'cancel', 'update:show'],
    template: `
      <div v-if="show" data-testid="compatibility-warning-modal">
        <div data-testid="compatibility-warning-title">{{ title }}</div>
        <div data-testid="compatibility-warning-text">
          {{ summaryText }} | {{ warningText }} | {{ conflictsTitle }} | {{ conflicts.length }}
        </div>
        <button data-testid="compatibility-warning-proceed" @click="$emit('proceed')">{{ proceedLabel }}</button>
        <button data-testid="compatibility-warning-cancel" @click="$emit('cancel')">{{ cancelLabel }}</button>
      </div>
    `,
  },
}));

function seedMandatoryUpgradeState() {
  resetVersionState();
  initialVersionCheckState.value = 'done';
  mocks.disconnectOrganization.mockClear();
  mocks.logout.mockClear();
  mocks.setLast.mockClear();
  mocks.startUpdate.mockClear();
  mocks.installUpdate.mockClear();
  mocks.cancelUpdate.mockClear();
  mocks.electronUpdater.startUpdate.mockClear();
  mocks.electronUpdater.installUpdate.mockClear();
  mocks.electronUpdater.cancelUpdate.mockClear();
  mocks.toast.error.mockClear();
  mocks.toast.warning.mockClear();
  mocks.toast.info.mockClear();
  mocks.toast.success.mockClear();
  mocks.userStore.organizations = [];
  mocks.userStore.selectedOrganization = null;
  mocks.userStore.selectOrganization.mockClear();

  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  setVersionDataForOrg('https://conflict-a', {
    latestSupportedVersion: '1.0.0',
    minimumSupportedVersion: '99.0.0',
    updateUrl: null,
  });
  vi.setSystemTime(new Date('2024-01-01T00:00:05Z'));
  setVersionDataForOrg('https://conflict-b', {
    latestSupportedVersion: '0.8.0',
    minimumSupportedVersion: '99.0.0',
    updateUrl: null,
  });
  vi.setSystemTime(new Date('2024-01-01T00:00:10Z'));
  setVersionDataForOrg('https://triggering', {
    latestSupportedVersion: '2.0.0',
    minimumSupportedVersion: '99.0.0',
    updateUrl: 'https://download/v2',
  });

  mocks.userStore.organizations = [
    { id: 'conflict-a', serverUrl: 'https://conflict-a', nickname: 'Conflict A' },
    { id: 'conflict-b', serverUrl: 'https://conflict-b', nickname: 'Conflict B' },
    { id: 'triggering', serverUrl: 'https://triggering', nickname: 'Triggering Org' },
  ];
  mocks.userStore.selectedOrganization = mocks.userStore.organizations[2];
}

describe('MandatoryUpgrade', () => {
  beforeEach(() => {
    seedMandatoryUpgradeState();
  });

  test('renders inline mandatory warning copy for multiple mandatory backends', () => {
    const wrapper = mount(MandatoryUpgrade, {
      global: {
        stubs: {
          Transition: false,
        },
      },
    });

    expect(wrapper.text()).toContain('Update Required');
    expect(wrapper.text()).toContain('Triggering Org');
    expect(wrapper.text()).toContain(
      '3 backends currently require this mandatory upgrade. If you continue without updating, all of them will need to be disconnected.',
    );
    expect(wrapper.text()).toContain(
      'If you proceed, all incompatible backends listed below will be disconnected before the update download starts. If you cancel, only this triggering backend will be disconnected.',
    );
    expect(wrapper.find('[data-testid="compatibility-warning-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="compatibility-warning-title"]').text()).toBe(
      'Update Required - Compatibility Warning',
    );
    expect(wrapper.find('[data-testid="compatibility-warning-text"]').text()).toContain(
      'The organization Triggering Org requires an update to version 2.0.0.',
    );
    expect(wrapper.find('[data-testid="compatibility-warning-text"]').text()).toContain(
      'Incompatible Organizations | 2',
    );
    expect(wrapper.find('[data-testid="compatibility-warning-proceed"]').text()).toBe(
      'Disconnect Incompatible Backends and Continue',
    );
    expect(wrapper.find('[data-testid="compatibility-warning-cancel"]').text()).toBe(
      'Disconnect This Backend',
    );
  });

  test('proceed disconnects each incompatible backend before starting the download', async () => {
    const wrapper = mount(MandatoryUpgrade, {
      global: {
        stubs: {
          Transition: false,
        },
      },
    });

    await wrapper.get('[data-testid="compatibility-warning-proceed"]').trigger('click');
    await flushPromises();

    expect(mocks.disconnectOrganization).toHaveBeenCalledTimes(2);
    expect(mocks.disconnectOrganization).toHaveBeenNthCalledWith(1, 'https://conflict-a', 'compatibilityConflict');
    expect(mocks.disconnectOrganization).toHaveBeenNthCalledWith(2, 'https://conflict-b', 'compatibilityConflict');
    expect(mocks.electronUpdater.startUpdate).toHaveBeenCalledWith('https://download/v2');
  });

  test('cancel disconnects only the triggering backend', async () => {
    const wrapper = mount(MandatoryUpgrade, {
      global: {
        stubs: {
          Transition: false,
        },
      },
    });

    await wrapper.get('[data-testid="compatibility-warning-cancel"]').trigger('click');
    await flushPromises();

    expect(mocks.disconnectOrganization).toHaveBeenCalledTimes(1);
    expect(mocks.disconnectOrganization).toHaveBeenCalledWith('https://triggering', 'upgradeRequired');
    expect(mocks.electronUpdater.startUpdate).not.toHaveBeenCalled();
  });
});











