import { ref } from 'vue';
import { defineStore } from 'pinia';
import { Socket, io } from 'socket.io-client';

import useUserStore from './storeUser';

import { getLocalWebsocketPath } from '@renderer/services/organizationsService';

import { getAuthTokenFromSessionStorage, isUserLoggedIn, safeAwait } from '@renderer/utils';

const useWebsocketConnection = defineStore('websocketConnection', () => {
  /* Stores */
  const user = useUserStore();

  /* State */
  const sockets = ref<{ [severUrl: string]: Socket | null }>({});

  /* Actions */
  async function setup() {
    if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

    const newSockets: typeof sockets.value = {};
    const serverUrls = user.organizations.map(o => o.serverUrl);

    for (const serverUrl of serverUrls) {
      if (serverUrl.includes('localhost')) {
        const { data } = await safeAwait(getLocalWebsocketPath(serverUrl));
        if (data) {
          newSockets[serverUrl] = connect(serverUrl, data);
        }
      } else {
        newSockets[serverUrl] = connect(serverUrl, serverUrl);
      }
    }

    sockets.value = newSockets;
  }

  function connect(serverUrl: string, url: string) {
    const currentSocket = sockets.value[serverUrl];

    if (currentSocket) {
      const listeners = {
        connect: currentSocket.listeners('connect')[0],
        connect_error: currentSocket.listeners('connect_error')[0],
        disconnect: currentSocket.listeners('disconnect')[0],
      };

      currentSocket.off();

      currentSocket.on('connect', listeners.connect);
      currentSocket.on('connect_error', listeners.connect_error);
      currentSocket.on('disconnect', listeners.disconnect);

      currentSocket.io.opts.extraHeaders = {
        Authorization: `bearer ${getAuthTokenFromSessionStorage(serverUrl)}`,
      };
      currentSocket.connect();

      return currentSocket;
    } else {
      const newSocket = io(url, {
        path: '/ws',
        extraHeaders: {
          Authorization: `bearer ${getAuthTokenFromSessionStorage(serverUrl)}`,
        },
      });

      newSocket.on('connect', () => {
        console.log(`Connected to server ${url} with id: ${newSocket?.id}`);
      });

      newSocket.on('connect_error', error => {
        if (newSocket?.active) {
          // temporary failure, the socket will automatically try to reconnect
        } else {
          console.log(`Socket for ${serverUrl}: ${error.message}`);
        }
      });

      newSocket.on('disconnect', reason => {
        if (newSocket?.active) {
          // temporary disconnection, the socket will automatically try to reconnect
        } else {
          console.log(`Socket for ${serverUrl}: ${reason}`);
        }
      });
      return newSocket;
    }
  }

  function disconnect(serverUrl: string) {
    if (sockets.value[serverUrl]) {
      sockets.value[serverUrl].off();
      sockets.value[serverUrl].disconnect();
      sockets.value[serverUrl] = null;
    }
  }

  function on(serverUrl: string, event: string, callback: (...args: any[]) => void) {
    if (sockets.value[serverUrl]) {
      const subscription = (...args: any[]) => callback(...args);
      sockets.value[serverUrl].on(event, subscription);

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
