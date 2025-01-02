import useContactsStore from '@renderer/stores/storeContacts';
import useNotificationsStore from '@renderer/stores/storeNotifications';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';

import { useToast } from 'vue-toast-notification';

export default function useSetupStores() {
  /* Stores */
  const contacts = useContactsStore();
  const notifications = useNotificationsStore();
  const ws = useWebsocketConnection();

  const toast = useToast();

  const setupStores = async () => {
    const results = await Promise.allSettled([contacts.fetch(), notifications.setup(), ws.setup()]);
    results.forEach(r => {
      if (r.status === 'rejected') {
        const errorMessage =
          r.reason instanceof Error
            ? r.reason.message
            : typeof r.reason === 'string'
              ? r.reason
              : 'An unknown error occurred';
        toast.error(errorMessage);
      }
    });
  };

  return setupStores;
}
