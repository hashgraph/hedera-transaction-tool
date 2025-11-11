import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';

import { useToast } from 'vue-toast-notification';
import { errorToastOptions } from '@renderer/utils/toastOptions.ts';

export default function useSetupStores() {
  /* Stores */
  const ws = useWebsocketConnection();

  const toast = useToast();

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
        toast.error(errorMessage, errorToastOptions);
      }
    });
  };

  return setupStores;
}
