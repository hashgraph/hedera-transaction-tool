import type { DisconnectReason } from '@renderer/types/userStore';

import useUserStore from '@renderer/stores/storeUser';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useOrganizationConnection from '@renderer/stores/storeOrganizationConnection';

import { toggleAuthTokenInSessionStorage } from '@renderer/utils';

export async function disconnectOrganization(
  serverUrl: string,
  reason: DisconnectReason,
): Promise<void> {
  const userStore = useUserStore();
  const ws = useWebsocketConnection();
  const orgConnection = useOrganizationConnection();

  ws.disconnect(serverUrl);

  orgConnection.setConnectionStatus(serverUrl, 'disconnected', reason);

  toggleAuthTokenInSessionStorage(serverUrl, '', true);

  const org = userStore.organizations.find(o => o.serverUrl === serverUrl);
  if (org) {
    org.connectionStatus = 'disconnected';
    org.disconnectReason = reason;
    org.lastDisconnectedAt = new Date();
  }

  if (userStore.selectedOrganization?.serverUrl === serverUrl) {
    await userStore.selectOrganization(null);
  }

  console.log(
    `[${new Date().toISOString()}] DISCONNECT Organization: ${org?.nickname || serverUrl} (Server: ${serverUrl})`,
  );
  console.log(`  - Status: disconnected`);
  console.log(`  - Reason: ${reason}`);
}
