import type { Page, TestInfo } from '@playwright/test';

export function createLocalOnlyOrganizationServerUrl(
  testInfo: Pick<TestInfo, 'retry' | 'workerIndex'>,
) {
  return `http://local-organization-connection.test.invalid/${testInfo.workerIndex}-${testInfo.retry}-${Date.now()}`;
}

export async function createLocalOrganizationConnectionForTesting(
  page: Page,
  nickname: string,
  serverUrl: string,
) {
  await page.evaluate(
    async ({ nickname, serverUrl }) => {
      type LocalOrganization = {
        id: string;
        nickname: string;
        serverUrl: string;
        key: string;
      };

      type VueAppContainer = HTMLElement & {
        __vue_app__?: {
          config?: {
            globalProperties?: {
              $pinia?: {
                _s?: Map<
                  string,
                  {
                    organizations?: Array<
                      LocalOrganization & {
                        isLoading: boolean;
                        isServerActive: boolean;
                        loginRequired: boolean;
                      }
                    >;
                  }
                >;
              };
            };
          };
        };
      };

      type ElectronApiWindow = Window & {
        electronAPI: {
          local: {
            organizations: {
              addOrganization: (organization: {
                nickname: string;
                serverUrl: string;
                key: string;
              }) => Promise<LocalOrganization>;
            };
          };
        };
      };

      const electronWindow = window as unknown as ElectronApiWindow;
      const organization = await electronWindow.electronAPI.local.organizations.addOrganization({
        nickname,
        serverUrl,
        key: '',
      });

      const appRoot = document.querySelector('#app') as VueAppContainer | null;
      const userStore = appRoot?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get('user');

      if (!userStore?.organizations) {
        throw new Error('Unable to access user store organizations');
      }

      userStore.organizations = [
        ...userStore.organizations,
        {
          ...organization,
          isLoading: false,
          isServerActive: false,
          loginRequired: false,
        },
      ];
    },
    { nickname, serverUrl },
  );
}

type ConnectionStatus = 'connected' | 'disconnected' | 'upgradeRequired';
type DisconnectReason = 'upgradeRequired' | 'manual' | 'error' | 'compatibilityConflict';

export async function setOrganizationConnectionStatusForTesting(
  page: Page,
  serverUrl: string,
  status: ConnectionStatus,
  reason?: DisconnectReason,
) {
  await page.evaluate(
    ({ serverUrl, status, reason }) => {
      type ConnectionStore = {
        setConnectionStatus: (
          serverUrl: string,
          status: string,
          reason?: string,
        ) => void;
      };

      type VueAppContainer = HTMLElement & {
        __vue_app__?: {
          config?: {
            globalProperties?: {
              $pinia?: { _s?: Map<string, ConnectionStore> };
            };
          };
        };
      };

      const appRoot = document.querySelector('#app') as VueAppContainer | null;
      const store = appRoot?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get(
        'organizationConnection',
      );

      if (!store?.setConnectionStatus) {
        throw new Error('Unable to access organizationConnection store');
      }

      store.setConnectionStatus(serverUrl, status, reason);
    },
    { serverUrl, status, reason },
  );
}

type VersionStatus = 'current' | 'updateAvailable' | 'belowMinimum';

export async function setOrganizationVersionStateForTesting(
  page: Page,
  serverUrl: string,
  status: VersionStatus,
  latestVersion = '1.0.0',
) {
  await page.evaluate(
    ({ serverUrl, status, latestVersion }) => {
      type VersionData = {
        latestSupportedVersion: string;
        minimumSupportedVersion: string;
        updateUrl: string | null;
      };

      type TestHooks = {
        setVersionDataForOrg: (serverUrl: string, data: VersionData) => void;
        setVersionStatusForOrg: (serverUrl: string, status: string) => void;
      };

      const hooks = (window as unknown as { __testHooks__?: TestHooks }).__testHooks__;
      if (!hooks?.setVersionDataForOrg || !hooks?.setVersionStatusForOrg) {
        throw new Error('Test hooks for version state are not available on window');
      }

      hooks.setVersionDataForOrg(serverUrl, {
        latestSupportedVersion: latestVersion,
        minimumSupportedVersion: '0.0.1',
        updateUrl: null,
      });
      hooks.setVersionStatusForOrg(serverUrl, status);
    },
    { serverUrl, status, latestVersion },
  );
}

export async function attemptSelectOrganizationByServerUrl(
  page: Page,
  serverUrl: string,
): Promise<{ selectedServerUrl: string | null }> {
  return await page.evaluate(async serverUrl => {
    type Organization = { id: string; serverUrl: string };
    type UserStore = {
      organizations?: Organization[];
      selectedOrganization?: Organization | null;
      selectOrganization: (organization: Organization | null) => Promise<void>;
    };

    type VueAppContainer = HTMLElement & {
      __vue_app__?: {
        config?: {
          globalProperties?: {
            $pinia?: { _s?: Map<string, UserStore> };
          };
        };
      };
    };

    const appRoot = document.querySelector('#app') as VueAppContainer | null;
    const userStore = appRoot?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get('user');

    if (!userStore?.selectOrganization) {
      throw new Error('Unable to access user store');
    }

    const organization = userStore.organizations?.find(org => org.serverUrl === serverUrl) ?? null;
    if (!organization) {
      throw new Error(`Organization with serverUrl ${serverUrl} not found in user store`);
    }

    await userStore.selectOrganization(organization);
    return { selectedServerUrl: userStore.selectedOrganization?.serverUrl ?? null };
  }, serverUrl);
}

export async function resetOrganizationVersionStateForTesting(page: Page, serverUrl: string) {
  await page.evaluate(serverUrl => {
    type TestHooks = {
      resetVersionStatusForOrg: (serverUrl: string) => void;
    };

    const hooks = (window as unknown as { __testHooks__?: TestHooks }).__testHooks__;
    hooks?.resetVersionStatusForOrg?.(serverUrl);
  }, serverUrl);
}

export async function deleteLocalOrganizationConnectionForTesting(page: Page, serverUrl: string) {
  await page.evaluate(async serverUrl => {
    type LocalOrganization = {
      id: string;
      serverUrl: string;
    };

    type VueAppContainer = HTMLElement & {
      __vue_app__?: {
        config?: {
          globalProperties?: {
            $pinia?: {
              _s?: Map<
                string,
                {
                  organizations?: LocalOrganization[];
                }
              >;
            };
          };
        };
      };
    };

    type ElectronApiWindow = Window & {
      electronAPI: {
        local: {
          organizations: {
            getOrganizations: () => Promise<LocalOrganization[]>;
            deleteOrganization: (id: string) => Promise<boolean>;
          };
        };
      };
    };

    const electronWindow = window as unknown as ElectronApiWindow;
    const organizations = await electronWindow.electronAPI.local.organizations.getOrganizations();

    for (const organization of organizations) {
      if (organization.serverUrl === serverUrl) {
        await electronWindow.electronAPI.local.organizations.deleteOrganization(organization.id);
      }
    }

    const appRoot = document.querySelector('#app') as VueAppContainer | null;
    const userStore = appRoot?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get('user');
    if (userStore?.organizations) {
      userStore.organizations = userStore.organizations.filter(
        organization => organization.serverUrl !== serverUrl,
      );
    }
  }, serverUrl);
}
