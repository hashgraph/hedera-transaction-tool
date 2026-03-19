import { onBeforeMount, onBeforeUnmount } from 'vue';
import useUserStore from '@renderer/stores/storeUser';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';

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

  let dispose: (() => void) | null = null;

  /* Functions */
  const subscribe = () => {
    if (dispose) dispose();
    dispose = null;

    if (!user.selectedOrganization?.serverUrl) return;
    dispose = wsStore.on(user.selectedOrganization.serverUrl, eventName, (data: any) =>
      callback(data),
    );
  };

  /* Subscribe immediately on mount (in case WS is already connected) */
  onBeforeMount(subscribe);

  /* Handle WebSocket reconnections (for future reconnects) */
  const unsubscribeAction = wsStore.$onAction(ctx => {
    if (ctx.name !== 'setup') return;
    ctx.after(() => subscribe());
  });

  onBeforeUnmount(() => {
    if (dispose) dispose();
    dispose = null;
    unsubscribeAction();
  });
}
