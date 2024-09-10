import { defineStore } from 'pinia';
import { Socket, io } from 'socket.io-client';
import { computed, ref } from 'vue';

const useWebsocketConnection = defineStore('websocketConnection', () => {
  /* State */
  const socket = ref<Socket | null>(null);

  /* Computed */
  const isConnected = computed<boolean>(() => socket.value?.connected ?? false);
  const id = computed<string | null>(() => socket.value?.id ?? null);

  /* Actions */
  function setSocket(url: string | null) {
    if (socket.value) {
      socket.value.disconnect();
      socket.value.off();
    }

    if (!url) {
      socket.value = null;
      return;
    }

    socket.value = io(url, {
      path: '/ws',
      withCredentials: true,
    });

    socket.value.on('connect', () => {
      console.log(`Connected to server ${url} with id: ${socket.value?.id}`);
    });

    socket.value.on('connect_error', error => {
      if (socket.value?.active) {
        // temporary failure, the socket will automatically try to reconnect
      } else {
        console.log(error.message);
      }
    });

    socket.value.on('disconnect', reason => {
      if (socket.value?.active) {
        // temporary disconnection, the socket will automatically try to reconnect
      } else {
        console.log(reason);
      }
    });
  }

  function connect() {
    if (!socket.value) return;
    socket.value.connect();
  }

  function disconnect() {
    if (socket.value) {
      socket.value.disconnect();
    }
  }

  function on(event: string, callback: (...args: any[]) => void) {
    if (socket.value) {
      const subscription = (...args: any[]) => callback(...args);
      socket.value.on(event, subscription);

      return () => {
        socket.value?.off(event, subscription);
      };
    }

    return () => {};
  }

  function fullOffEvent(event: string) {
    if (socket.value) {
      socket.value.off(event);
    }
  }

  return {
    setSocket,
    connect,
    disconnect,
    on,
    fullOffEvent,
    id,
    isConnected,
  };
});

export default useWebsocketConnection;
