import { ref } from 'vue';
import { defineStore } from 'pinia';

import type { ConnectionStatus, DisconnectReason } from '@renderer/types/userStore';

const useOrganizationConnection = defineStore('organizationConnection', () => {
  /* State */
  const connectionStatuses = ref<{ [serverUrl: string]: ConnectionStatus }>({});
  const disconnectReasons = ref<{ [serverUrl: string]: DisconnectReason }>({});

  /* Actions */
  function setConnectionStatus(
    serverUrl: string,
    status: ConnectionStatus,
    reason?: DisconnectReason,
  ): void {
    connectionStatuses.value[serverUrl] = status;

    if (status === 'disconnected' && reason) {
      disconnectReasons.value[serverUrl] = reason;
      console.log(
        `[${new Date().toISOString()}] Organization disconnected: ${serverUrl}, Reason: ${reason}`,
      );
    } else if (status !== 'disconnected') {
      delete disconnectReasons.value[serverUrl];
    }

    console.log(
      `[${new Date().toISOString()}] Connection status updated: ${serverUrl} -> ${status}`,
    );
  }

  function getConnectionStatus(serverUrl: string): ConnectionStatus | null {
    return connectionStatuses.value[serverUrl] || null;
  }

  function getDisconnectReason(serverUrl: string): DisconnectReason | null {
    return disconnectReasons.value[serverUrl] || null;
  }

  return {
    connectionStatuses,
    setConnectionStatus,
    getConnectionStatus,
    getDisconnectReason,
  };
});

export default useOrganizationConnection;
