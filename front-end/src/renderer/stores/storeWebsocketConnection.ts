import { ref } from 'vue';
import { defineStore } from 'pinia';
import { Socket, io } from 'socket.io-client';

import useUserStore from './storeUser';
import useOrganizationConnection from './storeOrganizationConnection';

import { getLocalWebsocketPath } from '@renderer/services/organizationsService';

import { createLogger, getAuthTokenFromSessionStorage, isUserLoggedIn } from '@renderer/utils';
import { FRONTEND_VERSION } from '@renderer/utils/version';

interface WebsocketConnectionStoreReturn {
  disconnect: (serverUrl: string) => void;
  connect: (serverUrl: string, url: string) => Socket;
  on: (serverUrl: string, event: string, callback: (...args: any[]) => void) => () => void;
  setup: () => Promise<void>;
  isConnected: (serverUrl: string) => boolean;
  isLive: (serverUrl: string) => boolean;
}

const useWebsocketConnection = defineStore(
  'websocketConnection',
  (): WebsocketConnectionStoreReturn => {
    /* Stores */
    const user = useUserStore();
    const orgConnection = useOrganizationConnection();
    const logger = createLogger('renderer.websocket');

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
          logger.info('Skipping websocket setup for disconnected organization', {
            disconnectReason,
            serverUrl,
          });
          continue;
        }

        try {
          const url = serverUrl.includes('localhost')
            ? getLocalWebsocketPath(serverUrl)
            : serverUrl;
          const socket = connect(serverUrl, url);
          newSockets[serverUrl] = socket;
          if (socket.connected) {
            orgConnection.setConnectionStatus(serverUrl, 'connected');
          }
        } catch (error) {
          logger.error('Failed to connect to websocket server', {
            error,
            serverUrl,
          });
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
          socket.off();
          socket.disconnect();
          connectionStates.value[serverUrl] = 'disconnected';
        } else {
          if (socket.connected) {
            connectionStates.value[serverUrl] = 'connected';
          }
          return socket;
        }
      }

      connectionStates.value[serverUrl] = 'connecting';

      const newSocket = io(url, {
        path: '/ws',
        auth: cb => {
          const token = getAuthTokenFromSessionStorage(serverUrl);

          logger.debug('Preparing websocket auth payload', {
            hasToken: !!token,
            serverUrl,
          });

          cb({
            token: token ? `bearer ${token}` : undefined,
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
        logger.info('Websocket connected', {
          serverUrl,
          socketId: socket?.id,
          wsUrl,
        });
        connectionStates.value[serverUrl] = 'connected';
        orgConnection.setConnectionStatus(serverUrl, 'connected');
      });

      socket.on('connect_error', error => {
        logger.warn('Websocket connect_error received', {
          active: socket?.active,
          error,
          serverUrl,
          willRetry: socket?.active === true,
        });

        if (isVersionError(error.message)) {
          logger.error('Websocket disconnected due to version error', {
            error,
            serverUrl,
          });
          socket.disconnect();
          connectionStates.value[serverUrl] = 'disconnected';
          orgConnection.setConnectionStatus(serverUrl, 'disconnected', 'upgradeRequired');
          return;
        }

        if (socket?.active) {
          // temporary failure, the socket will automatically try to reconnect
          connectionStates.value[serverUrl] = 'connecting';
        } else {
          logger.warn('Websocket connection failed without retry', {
            error,
            serverUrl,
          });
          connectionStates.value[serverUrl] = 'disconnected';
          const currentStatus = orgConnection.getConnectionStatus(serverUrl);
          if (currentStatus !== 'disconnected') {
            orgConnection.setConnectionStatus(serverUrl, 'disconnected', 'error');
          }
        }
      });

      socket.on('disconnect', reason => {
        logger.info('Websocket disconnect event received', {
          active: socket?.active,
          connected: socket?.connected,
          reason,
          serverUrl,
          willReconnect: socket?.active === true,
        });

        if (socket?.active) {
          // temporary disconnection, the socket will automatically try to reconnect
          logger.info('Websocket will auto-reconnect', {
            serverUrl,
          });
          connectionStates.value[serverUrl] = 'connecting';
        } else {
          logger.info('Websocket disconnected without retry', {
            reason,
            serverUrl,
          });
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
      isLive,
    };
  },
);

export default useWebsocketConnection;
