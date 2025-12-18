import { ref } from 'vue';
import { defineStore } from 'pinia';
import { Socket, io } from 'socket.io-client';

import useUserStore from './storeUser';

import { getLocalWebsocketPath } from '@renderer/services/organizationsService';

import { getAuthTokenFromSessionStorage, isUserLoggedIn } from '@renderer/utils';
import { FRONTEND_VERSION } from '@renderer/utils/version';

const useWebsocketConnection = defineStore('websocketConnection', () => {
  /* Stores */
  const user = useUserStore();

  /* State */
  const sockets = ref<{ [serverUrl: string]: Socket | null }>({});

  /* Actions */
  async function setup() {
    if (!isUserLoggedIn(user.personal)) return;

    const newSockets: typeof sockets.value = {};
    const serverUrls = user.organizations.map(o => o.serverUrl);

    for (const serverUrl of serverUrls) {
      try {
        const url = serverUrl.includes('localhost') ? getLocalWebsocketPath(serverUrl) : serverUrl;
        newSockets[serverUrl] = connect(serverUrl, url);
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
      } else {
        socket.off();
        return socket;
      }
    }

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
  }

  function listenConnection(socket: Socket, wsUrl: string, serverUrl: string) {
    socket.on('connect', () => {
      console.log(`Connected to server ${wsUrl} with id: ${socket?.id}`);
    });

    socket.on('connect_error', error => {
      if (socket?.active) {
        // temporary failure, the socket will automatically try to reconnect
      } else {
        console.log(`Socket for ${serverUrl}: ${error.message}`);
      }
    });

    socket.on('disconnect', reason => {
      if (socket?.active) {
        // temporary disconnection, the socket will automatically try to reconnect
      } else {
        console.log(`Socket for ${serverUrl}: ${reason}`);
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

  return {
    disconnect,
    on,
    setup,
  };
});

export default useWebsocketConnection;
