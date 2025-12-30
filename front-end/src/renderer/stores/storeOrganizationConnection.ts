import { ref } from 'vue';
import { defineStore } from 'pinia';

import type { ConnectionStatus, DisconnectReason } from '@renderer/types/userStore';

const useOrganizationConnection = defineStore('organizationConnection', () => {
  /* State */
  const connectionStatuses = ref<{ [serverUrl: string]: ConnectionStatus }>({});
  const disconnectReasons = ref<{ [serverUrl: string]: DisconnectReason }>({});
  const disconnectTimestamps = ref<{ [serverUrl: string]: Date }>({});

  /* Actions */
  function setConnectionStatus(
    serverUrl: string,
    status: ConnectionStatus,
    reason?: DisconnectReason,
  ): void {
    connectionStatuses.value[serverUrl] = status;

    if (status === 'disconnected' && reason) {
      disconnectReasons.value[serverUrl] = reason;
      disconnectTimestamps.value[serverUrl] = new Date();
      console.log(
        `[${new Date().toISOString()}] Organization disconnected: ${serverUrl}, Reason: ${reason}`,
      );
    } else if (status !== 'disconnected') {
      delete disconnectReasons.value[serverUrl];
      delete disconnectTimestamps.value[serverUrl];
    }

    console.log(
      `[${new Date().toISOString()}] Connection status updated: ${serverUrl} -> ${status}`,
    );
  }

  function getConnectionStatus(serverUrl: string): ConnectionStatus | null {
    return connectionStatuses.value[serverUrl] || null;
  }

  function isConnected(serverUrl: string): boolean {
    const status = connectionStatuses.value[serverUrl];
    return status === 'connected';
  }

  function getDisconnectReason(serverUrl: string): DisconnectReason | null {
    return disconnectReasons.value[serverUrl] || null;
  }

  function getDisconnectTimestamp(serverUrl: string): Date | null {
    return disconnectTimestamps.value[serverUrl] || null;
  }

  function resetConnectionStatus(serverUrl: string): void {
    delete connectionStatuses.value[serverUrl];
    delete disconnectReasons.value[serverUrl];
    delete disconnectTimestamps.value[serverUrl];
    console.log(`[${new Date().toISOString()}] Connection status reset: ${serverUrl}`);
  }

  function resetAll(): void {
    connectionStatuses.value = {};
    disconnectReasons.value = {};
    disconnectTimestamps.value = {};
    console.log(`[${new Date().toISOString()}] All connection statuses reset`);
  }

  return {
    connectionStatuses,
    disconnectReasons,
    disconnectTimestamps,
    setConnectionStatus,
    getConnectionStatus,
    isConnected,
    getDisconnectReason,
    getDisconnectTimestamp,
    resetConnectionStatus,
    resetAll,
  };
});

export default useOrganizationConnection;
