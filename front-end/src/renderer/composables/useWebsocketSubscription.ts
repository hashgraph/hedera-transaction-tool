import { onBeforeMount } from 'vue';
import useUserStore from '@renderer/stores/storeUser';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useDisposableWs from '@renderer/composables/useDisposableWs';

/**
 * Subscribe to a WebSocket event for the current organization
 * Automatically handles initial connection and cleanup
 *
 * @param eventName - The WebSocket event to listen for
 * @param callback - Function to call when event is received
 */
export default function useWebsocketSubscription(
  eventName: string,
  callback: (payload?: unknown) => void | Promise<void>,
) {
  const user = useUserStore();
  const wsStore = useWebsocketConnection();
  const ws = useDisposableWs();

  /* Functions */
  const subscribe = () => {
    if (!user.selectedOrganization?.serverUrl) return;
    ws.on(user.selectedOrganization.serverUrl, eventName, (data: any) => callback(data));
  };

  /* Subscribe immediately on mount (in case WS is already connected) */
  onBeforeMount(subscribe);

  /* Handle WebSocket reconnections (for future reconnects) */
  wsStore.$onAction(ctx => {
    if (ctx.name !== 'setup') return;
    ctx.after(() => subscribe());
  });
}
