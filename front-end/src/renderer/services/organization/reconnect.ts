import useVersionCheck from '@renderer/composables/useVersionCheck';

import useUserStore from '@renderer/stores/storeUser';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useOrganizationConnection from '@renderer/stores/storeOrganizationConnection';
import {
  getVersionStatusForOrg,
  organizationVersionData,
} from '@renderer/stores/versionState';

import { getLocalWebsocketPath } from '@renderer/services/organizationsService';
import { isVersionBelowMinimum } from '@renderer/services/organization/versionCompatibility';
import { login } from '@renderer/services/organization';

import { createLogger } from '@renderer/utils/logger';
import { RequestError } from '@renderer/utils/axios';
import {
  getAuthTokenFromSessionStorage,
  toggleAuthTokenInSessionStorage,
} from '@renderer/utils/userStoreHelpers';

import {
  getOrganizationCredentials,
  updateOrganizationCredentials,
} from '../organizationCredentials';

const logger = createLogger('renderer.organization.reconnect');

export async function reconnectOrganization(serverUrl: string): Promise<{
  success: boolean;
  requiresUpdate?: boolean;
}> {
  const userStore = useUserStore();
  const ws = useWebsocketConnection();
  const orgConnection = useOrganizationConnection();
  const { performVersionCheck } = useVersionCheck();

  const org = userStore.organizations.find(o => o.serverUrl === serverUrl);
  const user = userStore.personal;
  if (!org) {
    logger.error('Organization not found during reconnect', { serverUrl });
    throw new Error('Organization not found');
  }

  try {
    let sawLogin426 = false;
    const token = getAuthTokenFromSessionStorage(org.serverUrl);
    if (!token && user && user.isLoggedIn && (user.password || user.useKeychain)) {
      const credentials = await getOrganizationCredentials(org.id, user.id, user.password);

      if (credentials?.password) {
        try {
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
        } catch (loginError) {
          // HTTP 426 from /auth/login means the backend rejected the client
          // as below its minimum supported version. If the 426 payload has
          // valid version metadata, the global axios interceptor records it
          // and the derived status drives MandatoryUpgrade.
          // Swallow the error so we don't double-surface it as a generic
          // "Failed to Sign In" toast; the version-check path below decides
          // whether this is requiresUpdate vs a generic reconnect failure.
          if (loginError instanceof RequestError && loginError.status === 426) {
            sawLogin426 = true;
            logger.info('Org login returned 426 during reconnect; deferring to version check', {
              serverUrl,
            });
          } else {
            throw loginError;
          }
        }
      }
    }
    logger.info('Starting organization reconnect version check', {
      organization: org.nickname || serverUrl,
      serverUrl,
    });

    // performVersionCheck stores fresh version data via setVersionDataForOrg;
    // status and compat are derived from that data automatically.
    await performVersionCheck(serverUrl);

    const versionStatus = getVersionStatusForOrg(serverUrl);
    const versionData = organizationVersionData.value[serverUrl];

    // If login already returned 426 but no valid version metadata was recorded,
    // treat it as an unreachable/rejected org instead of pretending reconnect
    // succeeded.
    if (sawLogin426 && !versionData) {
      logger.warn('Reconnect aborted: login returned 426 without usable version metadata', {
        serverUrl,
      });
      return { success: false };
    }

    if (versionStatus === 'belowMinimum' || (versionData && isVersionBelowMinimum(versionData))) {
      logger.warn('Organization reconnect requires frontend update', {
        organization: org.nickname || serverUrl,
        serverUrl,
      });

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
    // Re-throw so the caller's withLoader (which lives in a valid Vue setup
    // context) can surface the error via ToastManager. We can't toast here
    // because Vue's inject() doesn't work from this async store-action path.
    throw error instanceof Error
      ? error
      : new Error(`Failed to reconnect to ${org.nickname || serverUrl}.`);
  }
}
