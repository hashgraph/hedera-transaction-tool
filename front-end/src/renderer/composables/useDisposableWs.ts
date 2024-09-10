import { onBeforeUnmount, ref } from 'vue';

import useWebsocketStore from '@renderer/stores/storeWebsocketConnection';

export default function useDisposableWs() {
  /* State */
  const ws = useWebsocketStore();
  const disposers = ref<(() => void)[]>([]);

  /* Methods */
  function on(serverUrl: string, event: string, callback: (data: any) => void) {
    disposers.value.push(ws.on(serverUrl, event, callback));
  }

  /* Hooks */
  onBeforeUnmount(() => {
    disposers.value.forEach(dispose => dispose());
  });

  return { on };
}
