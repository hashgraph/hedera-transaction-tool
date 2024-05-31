import { onBeforeUnmount, onMounted, ref } from 'vue';

import useWebsocketStore from '@renderer/stores/storeWebsocketConnection';

export default function useDisposableWs() {
  /* State */
  const ws = useWebsocketStore();
  const disposers = ref<(() => void)[]>([]);

  /* Methods */
  function on(event: string, callback: (data: any) => void) {
    disposers.value.push(ws.on(event, callback));
  }

  function off(event: string) {
    ws.fullOffEvent(event);
  }

  /* Hooks */
  onMounted(async () => {});

  onBeforeUnmount(() => {
    disposers.value.forEach(dispose => dispose());
  });

  return { on, off };
}
