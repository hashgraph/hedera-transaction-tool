import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';

import { ToastManager } from '@renderer/utils/ToastManager';

export default function useSetupStores() {
  /* Stores */
  const ws = useWebsocketConnection();

  const toastManager = ToastManager.inject()

  const setupStores = async () => {
    const results = await Promise.allSettled([ws.setup()]);
    results.forEach(r => {
      if (r.status === 'rejected') {
        const errorMessage =
          r.reason instanceof Error
            ? r.reason.message
            : typeof r.reason === 'string'
              ? r.reason
              : 'An unknown error occurred';
        toastManager.error(errorMessage);
      }
    });
  };

  return setupStores;
}
