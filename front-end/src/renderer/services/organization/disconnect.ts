import type { DisconnectReason } from '@renderer/types/userStore';

import useUserStore from '@renderer/stores/storeUser';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useOrganizationConnection from '@renderer/stores/storeOrganizationConnection';

import { toggleAuthTokenInSessionStorage } from '@renderer/utils';
import { useToast } from 'vue-toast-notification';
import { errorToastOptions, infoToastOptions } from '@renderer/utils/toastOptions';
import { updateOrganizationCredentials } from '../organizationCredentials';

export async function disconnectOrganization(
  serverUrl: string,
  reason: DisconnectReason,
): Promise<void> {
  const userStore = useUserStore();
  const ws = useWebsocketConnection();
  const orgConnection = useOrganizationConnection();
  const toast = useToast();

  ws.disconnect(serverUrl);

  orgConnection.setConnectionStatus(serverUrl, 'disconnected', reason);

  toggleAuthTokenInSessionStorage(serverUrl, '', true);

  const org = userStore.organizations.find(o => o.serverUrl === serverUrl);
  if (org && userStore.personal && userStore.personal.isLoggedIn) {
    try {
      await updateOrganizationCredentials(org.id, userStore.personal.id, undefined, undefined, null);
      await userStore.refetchOrganizationTokens();
    } catch (error) {
      console.error('Failed to remove JWT from SQLite:', error);
    }
  }

  if (org) {
    org.connectionStatus = 'disconnected';
    org.disconnectReason = reason;
    org.lastDisconnectedAt = new Date();
  }

  if (userStore.selectedOrganization?.serverUrl === serverUrl) {
    await userStore.selectOrganization(null);
  }

  // Show toast notification based on disconnect reason
  if (reason === 'upgradeRequired') {
    toast.info(
      `Disconnected from ${org?.nickname || serverUrl}. Update required to reconnect.`,
      infoToastOptions,
    );
  } else if (reason === 'compatibilityConflict') {
    toast.warning(
      `Disconnected from ${org?.nickname || serverUrl}. Compatibility conflict detected.`,
      errorToastOptions,
    );
  } else if (reason === 'manual') {
    toast.info(`Disconnected from ${org?.nickname || serverUrl}`, infoToastOptions);
  } else if (reason === 'error') {
    toast.error(
      `Disconnected from ${org?.nickname || serverUrl}. Connection error occurred.`,
      errorToastOptions,
    );
  }

  console.log(
    `[${new Date().toISOString()}] DISCONNECT Organization: ${org?.nickname || serverUrl} (Server: ${serverUrl})`,
  );
  console.log(`  - Status: disconnected`);
  console.log(`  - Reason: ${reason}`);
}
