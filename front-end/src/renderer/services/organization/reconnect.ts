import { ToastManager } from '@renderer/utils/ToastManager';

import useVersionCheck from '@renderer/composables/useVersionCheck';

import useUserStore from '@renderer/stores/storeUser';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useOrganizationConnection from '@renderer/stores/storeOrganizationConnection';
import {
  setOrgVersionBelowMinimum,
  setVersionDataForOrg,
  getVersionStatusForOrg,
  organizationVersionData,
  organizationCompatibilityResults,
} from '@renderer/stores/versionState';

import { getLocalWebsocketPath } from '@renderer/services/organizationsService';
import { checkCompatibilityAcrossOrganizations } from '@renderer/services/organization/versionCompatibility';
import { isVersionBelowMinimum } from '@renderer/services/organization/versionCompatibility';
import { checkVersion, login } from '@renderer/services/organization';

import { createLogger } from '@renderer/utils';
import { FRONTEND_VERSION } from '@renderer/utils/version';
import {
  getAuthTokenFromSessionStorage,
  toggleAuthTokenInSessionStorage,
} from '@renderer/utils/userStoreHelpers';

import {
  getOrganizationCredentials,
  updateOrganizationCredentials,
} from '../organizationCredentials';

export async function reconnectOrganization(serverUrl: string): Promise<{
  success: boolean;
  requiresUpdate?: boolean;
  hasCompatibilityConflict?: boolean;
}> {
  const userStore = useUserStore();
  const ws = useWebsocketConnection();
  const orgConnection = useOrganizationConnection();
  const { performVersionCheck } = useVersionCheck();
  const toastManager = ToastManager.inject();
  const logger = createLogger('renderer.organization.reconnect');

  const org = userStore.organizations.find(o => o.serverUrl === serverUrl);
  const user = userStore.personal;
  if (!org) {
    logger.error('Organization not found during reconnect', {
      serverUrl,
    });
    toastManager.error('Organization not found');
    return { success: false };
  }

  try {
    const token = getAuthTokenFromSessionStorage(org.serverUrl);
    if (!token && user && user.isLoggedIn && (user.password || user.useKeychain)) {
      const credentials = await getOrganizationCredentials(org.id, user.id, user.password);

      if (credentials?.password) {
        const { jwtToken } = await login(
          org.serverUrl,
          credentials.email,
          credentials.password,
        );

        await updateOrganizationCredentials(
          org.id,
          user.id,
          undefined,
          undefined,
          jwtToken,
        );
        toggleAuthTokenInSessionStorage(org.serverUrl, jwtToken, false);
      }
    }
    logger.info('Starting organization reconnect version check', {
      organization: org.nickname || serverUrl,
      serverUrl,
    });

    await performVersionCheck(serverUrl);

    const versionStatus = getVersionStatusForOrg(serverUrl);
    const versionData = organizationVersionData.value[serverUrl];

    if (versionStatus === 'belowMinimum' || (versionData && isVersionBelowMinimum(versionData))) {
      logger.warn('Organization reconnect requires frontend update', {
        organization: org.nickname || serverUrl,
        serverUrl,
      });

      let versionResponse = versionData;
      if (!versionResponse) {
        try {
          versionResponse = await checkVersion(serverUrl, FRONTEND_VERSION);
          setVersionDataForOrg(serverUrl, versionResponse);
        } catch (versionError) {
          logger.error('Version check failed during reconnect', {
            error: versionError,
            serverUrl,
          });
          return { success: false, requiresUpdate: true };
        }
      }

      if (versionResponse.latestSupportedVersion) {
        const compatibilityResult = await checkCompatibilityAcrossOrganizations(
          versionResponse.latestSupportedVersion,
          serverUrl,
        );

        organizationCompatibilityResults.value[serverUrl] = compatibilityResult;

        if (versionResponse.updateUrl) {
          setOrgVersionBelowMinimum(serverUrl, versionResponse.updateUrl);
        }

        logger.info('Reconnect compatibility check completed', {
          conflicts: compatibilityResult.conflicts.map(c => c.organizationName),
          hasCompatibilityConflict: compatibilityResult.hasConflict,
          organization: org.nickname || serverUrl,
          serverUrl,
        });

        return {
          success: false,
          requiresUpdate: true,
          hasCompatibilityConflict: compatibilityResult.hasConflict,
        };
      }

      return { success: false, requiresUpdate: true };
    }

    logger.info('Organization reconnect version check passed', {
      organization: org.nickname || serverUrl,
      serverUrl,
    });

    const wsUrl = serverUrl.includes('localhost') ? getLocalWebsocketPath(serverUrl) : serverUrl;
    ws.connect(serverUrl, wsUrl);

    await userStore.refetchUserState();

    orgConnection.setConnectionStatus(serverUrl, 'connected');

    if (org) {
      org.connectionStatus = 'connected';
      delete org.disconnectReason;
      delete org.lastDisconnectedAt;
    }

    logger.info('Organization reconnected successfully', {
      organization: org.nickname || serverUrl,
      serverUrl,
      status: 'connected',
    });

    return { success: true };
  } catch (error) {
    logger.error('Organization reconnect failed', {
      error,
      organization: org.nickname || serverUrl,
      serverUrl,
    });

    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('fetch')) {
        toastManager.error(
          `Failed to reconnect to ${org.nickname || serverUrl}. Network error.`,
        );
        return { success: false };
      }

      if (
        error.message.includes('auth') ||
        error.message.includes('401') ||
        error.message.includes('403')
      ) {
        toastManager.error(
          `Failed to reconnect to ${org.nickname || serverUrl}. Authentication failed.`,
        );
        return { success: false };
      }
    }

    toastManager.error(
      `Failed to reconnect to ${org.nickname || serverUrl}. ${error instanceof Error ? error.message : 'Unknown error'}`,
    );

    return { success: false };
  }
}
