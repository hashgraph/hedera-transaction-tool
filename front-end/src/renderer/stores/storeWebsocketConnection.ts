import { ref } from 'vue';
import { defineStore } from 'pinia';
import { Socket, io } from 'socket.io-client';

import useUserStore from './storeUser';
import useOrganizationConnection from './storeOrganizationConnection';

import { getLocalWebsocketPath } from '@renderer/services/organizationsService';

import { getAuthTokenFromSessionStorage, isUserLoggedIn } from '@renderer/utils';
import { FRONTEND_VERSION } from '@renderer/utils/version';

// Define store interface to avoid TypeScript inference issues with deep node_modules paths
interface WebsocketConnectionStoreReturn {
  disconnect: (serverUrl: string) => void;
  connect: (serverUrl: string, url: string) => Socket;
  on: (serverUrl: string, event: string, callback: (...args: any[]) => void) => () => void;
  setup: () => Promise<void>;
  isConnected: (serverUrl: string) => boolean;
  getConnectionState: (serverUrl: string) => 'connected' | 'disconnected' | 'connecting';
  isLive: (serverUrl: string) => boolean;
}

const useWebsocketConnection = defineStore('websocketConnection', (): WebsocketConnectionStoreReturn => {
  /* Stores */
  const user = useUserStore();
  const orgConnection = useOrganizationConnection();

  /* State */
  const sockets = ref<{ [serverUrl: string]: Socket | null }>({});
  const connectionStates = ref<{
    [serverUrl: string]: 'connected' | 'disconnected' | 'connecting';
  }>({});

  /* Actions */
  async function setup() {
    if (!isUserLoggedIn(user.personal)) return;

    const newSockets: typeof sockets.value = {};
    const serverUrls = user.organizations.map(o => o.serverUrl);

    for (const serverUrl of serverUrls) {
      const connectionStatus = orgConnection.getConnectionStatus(serverUrl);
      const disconnectReason = orgConnection.getDisconnectReason(serverUrl);

      if (connectionStatus === 'disconnected' && disconnectReason === 'upgradeRequired') {
        console.log(
          `[${new Date().toISOString()}] Skipping websocket setup for disconnected organization: ${serverUrl} (Reason: ${disconnectReason})`,
        );
        continue;
      }

      try {
        const url = serverUrl.includes('localhost') ? getLocalWebsocketPath(serverUrl) : serverUrl;
        const socket = connect(serverUrl, url);
        newSockets[serverUrl] = connect(serverUrl, url);
        if (socket.connected) {
          orgConnection.setConnectionStatus(serverUrl, 'connected');
        }
      } catch (error) {
        console.error(`Failed to connect to server ${serverUrl}:`, error);
        disconnect(serverUrl);
      }
    }

    sockets.value = newSockets;
  }

  function connect(serverUrl: string, url: string) {
    const socket = sockets.value[serverUrl];

    if (socket) {
      //@ts-expect-error - auth is missing in typings
      if (socket.auth?.token !== `bearer ${getAuthTokenFromSessionStorage(serverUrl)}`) {
        socket.disconnect();
        connectionStates.value[serverUrl] = 'disconnected';
      } else {
        socket.off();
        if (socket.connected) {
          connectionStates.value[serverUrl] = 'connected';
        }
        return socket;
      }
    }

    connectionStates.value[serverUrl] = 'connecting';

    const newSocket = io(url, {
      path: '/ws',
      // Use a function so token is fetched on EVERY connection attempt, in case the token has been updated
      auth: cb => {
        cb({
          token: `bearer ${getAuthTokenFromSessionStorage(serverUrl)}`,
          version: FRONTEND_VERSION,
        });
      },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    listenConnection(newSocket, url, serverUrl);

    return newSocket;
  }

  function disconnect(serverUrl: string) {
    const socket = sockets.value[serverUrl];
    if (socket) {
      socket.off();
      socket.disconnect();
      sockets.value[serverUrl] = null;
    }
    connectionStates.value[serverUrl] = 'disconnected';
  }

  function isVersionError(errorMessage: string): boolean {
    const versionErrorPatterns = [
      'no longer supported',
      'Please update your application',
      'Frontend version is required',
      'Invalid frontend version',
    ];
    return versionErrorPatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase()),
    );
  }

  function listenConnection(socket: Socket, wsUrl: string, serverUrl: string) {
    socket.on('connect', () => {
      console.log(`Connected to server ${wsUrl} with id: ${socket?.id}`);
      connectionStates.value[serverUrl] = 'connected';
      orgConnection.setConnectionStatus(serverUrl, 'connected');
    });

    socket.on('connect_error', error => {
      if (isVersionError(error.message)) {
        console.error(
          `Socket for ${serverUrl}: Version error - ${error.message}. Disconnecting permanently.`,
        );
        socket.disconnect();
        connectionStates.value[serverUrl] = 'disconnected';
        orgConnection.setConnectionStatus(serverUrl, 'disconnected', 'upgradeRequired');
        return;
      }

      if (socket?.active) {
        // temporary failure, the socket will automatically try to reconnect
        connectionStates.value[serverUrl] = 'connecting';
      } else {
        console.log(`Socket for ${serverUrl}: ${error.message}`);
        connectionStates.value[serverUrl] = 'disconnected';
        const currentStatus = orgConnection.getConnectionStatus(serverUrl);
        if (currentStatus !== 'disconnected') {
          orgConnection.setConnectionStatus(serverUrl, 'disconnected', 'error');
        }
      }
    });

    socket.on('disconnect', reason => {
      if (socket?.active) {
        // temporary disconnection, the socket will automatically try to reconnect
        connectionStates.value[serverUrl] = 'connecting';
      } else {
        console.log(`Socket for ${serverUrl}: ${reason}`);
        connectionStates.value[serverUrl] = 'disconnected';
        const currentReason = orgConnection.getDisconnectReason(serverUrl);
        if (currentReason !== 'upgradeRequired' && currentReason !== 'compatibilityConflict') {
          orgConnection.setConnectionStatus(serverUrl, 'disconnected', 'error');
        }
      }
    });
  }

  function on(serverUrl: string, event: string, callback: (...args: any[]) => void) {
    const socket = sockets.value[serverUrl];
    if (socket) {
      const subscription = (...args: any[]) => callback(...args);
      socket.on(event, subscription);

      return () => {
        sockets.value[serverUrl]?.off(event, subscription);
      };
    }

    return () => {};
  }

  function isConnected(serverUrl: string): boolean {
    const state = connectionStates.value[serverUrl];
    return state === 'connected';
  }

  function getConnectionState(serverUrl: string): 'connected' | 'disconnected' | 'connecting' {
    return connectionStates.value[serverUrl] || 'disconnected';
  }

  function isLive(serverUrl: string): boolean {
    const socket = sockets.value[serverUrl];
    return socket?.connected === true;
  }

  return {
    disconnect,
    connect,
    on,
    setup,
    isConnected,
    getConnectionState,
    isLive,
  };
});

export default useWebsocketConnection;
