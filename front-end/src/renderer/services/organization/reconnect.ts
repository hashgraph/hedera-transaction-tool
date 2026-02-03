import { useToast } from 'vue-toast-notification';

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

import { FRONTEND_VERSION } from '@renderer/utils/version';
import {
  getAuthTokenFromSessionStorage,
  toggleAuthTokenInSessionStorage,
} from '@renderer/utils/userStoreHelpers';

import { errorToastOptions } from '@renderer/utils/toastOptions';
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
  const toast = useToast();

  const org = userStore.organizations.find(o => o.serverUrl === serverUrl);
  const user = userStore.personal;
  if (!org) {
    console.error(`[${new Date().toISOString()}] RECONNECT Organization not found: ${serverUrl}`);
    toast.error('Organization not found', errorToastOptions);
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
    console.log(
      `[${new Date().toISOString()}] RECONNECT Starting version check for: ${org.nickname || serverUrl}`,
    );

    await performVersionCheck(serverUrl);

    const versionStatus = getVersionStatusForOrg(serverUrl);
    const versionData = organizationVersionData.value[serverUrl];

    if (versionStatus === 'belowMinimum' || (versionData && isVersionBelowMinimum(versionData))) {
      console.log(
        `[${new Date().toISOString()}] RECONNECT Version check failed: ${org.nickname || serverUrl} requires update`,
      );

      let versionResponse = versionData;
      if (!versionResponse) {
        try {
          versionResponse = await checkVersion(serverUrl, FRONTEND_VERSION);
          setVersionDataForOrg(serverUrl, versionResponse);
        } catch (versionError) {
          console.error('Version check failed during reconnect:', versionError);
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

        console.log(
          `[${new Date().toISOString()}] RECONNECT Compatibility check completed: ${org.nickname || serverUrl}`,
        );
        console.log(`  - Has conflicts: ${compatibilityResult.hasConflict}`);
        if (compatibilityResult.hasConflict) {
          console.log(
            `  - Conflicts: ${compatibilityResult.conflicts.map(c => c.organizationName).join(', ')}`,
          );
        }

        return {
          success: false,
          requiresUpdate: true,
          hasCompatibilityConflict: compatibilityResult.hasConflict,
        };
      }

      return { success: false, requiresUpdate: true };
    }

    console.log(
      `[${new Date().toISOString()}] RECONNECT Version check passed: ${org.nickname || serverUrl}`,
    );

    const wsUrl = serverUrl.includes('localhost') ? getLocalWebsocketPath(serverUrl) : serverUrl;
    ws.connect(serverUrl, wsUrl);

    await userStore.refetchUserState();

    orgConnection.setConnectionStatus(serverUrl, 'connected');

    if (org) {
      org.connectionStatus = 'connected';
      delete org.disconnectReason;
      delete org.lastDisconnectedAt;
    }

    console.log(
      `[${new Date().toISOString()}] RECONNECT Success: ${org.nickname || serverUrl} (Server: ${serverUrl})`,
    );
    console.log(`  - Status: connected`);
    console.log(`  - Details: Version check passed, websocket connected`);

    return { success: true };
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] RECONNECT Failed: ${org.nickname || serverUrl} (Server: ${serverUrl})`,
    );
    console.error(`  - Error:`, error);

    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('fetch')) {
        toast.error(
          `Failed to reconnect to ${org.nickname || serverUrl}. Network error.`,
          errorToastOptions,
        );
        return { success: false };
      }

      if (
        error.message.includes('auth') ||
        error.message.includes('401') ||
        error.message.includes('403')
      ) {
        toast.error(
          `Failed to reconnect to ${org.nickname || serverUrl}. Authentication failed.`,
          errorToastOptions,
        );
        return { success: false };
      }
    }

    toast.error(
      `Failed to reconnect to ${org.nickname || serverUrl}. ${error instanceof Error ? error.message : 'Unknown error'}`,
      errorToastOptions,
    );

    return { success: false };
  }
}
