import type { DisconnectReason } from '@renderer/types/userStore';

import useUserStore from '@renderer/stores/storeUser';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useOrganizationConnection from '@renderer/stores/storeOrganizationConnection';

import { toggleAuthTokenInSessionStorage } from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager';
import { updateOrganizationCredentials } from '../organizationCredentials';

export async function disconnectOrganization(
  serverUrl: string,
  reason: DisconnectReason,
): Promise<void> {
  const userStore = useUserStore();
  const ws = useWebsocketConnection();
  const orgConnection = useOrganizationConnection();
  const toastManager = ToastManager.inject();

  ws.disconnect(serverUrl);

  orgConnection.setConnectionStatus(serverUrl, 'disconnected', reason);

  toggleAuthTokenInSessionStorage(serverUrl, '', true);

  const org = userStore.organizations.find(o => o.serverUrl === serverUrl);
  const user = userStore.personal;
  if (org && user && user.isLoggedIn) {
    await updateOrganizationCredentials(org.id, user.id, undefined, undefined, null);
    org.connectionStatus = 'disconnected';
    org.disconnectReason = reason;
    org.lastDisconnectedAt = new Date();
  }

  if (userStore.selectedOrganization?.serverUrl === serverUrl) {
    await userStore.selectOrganization(null);
  }

  if (reason === 'upgradeRequired') {
    toastManager.warning(
      `Disconnected from ${org?.nickname || serverUrl}. Update required to reconnect.`,
    );
  } else if (reason === 'compatibilityConflict') {
    toastManager.warning(
      `Disconnected from ${org?.nickname || serverUrl}. Compatibility conflict detected.`,
    );
  } else if (reason === 'manual') {
    toastManager.info(`Disconnected from ${org?.nickname || serverUrl}`);
  } else if (reason === 'error') {
    toastManager.error(
      `Disconnected from ${org?.nickname || serverUrl}. Connection error occurred.`,
    );
  }

  console.log(
    `[${new Date().toISOString()}] DISCONNECT Organization: ${org?.nickname || serverUrl} (Server: ${serverUrl})`,
  );
  console.log(`  - Status: disconnected`);
  console.log(`  - Reason: ${reason}`);
}
