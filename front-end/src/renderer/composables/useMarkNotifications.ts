import { onBeforeUnmount, onMounted } from 'vue';

import { NotificationType } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNotificationsStore from '@renderer/stores/storeNotifications';

import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

export default function useMarkNotifications(notificationTypes: NotificationType[]) {
  /* Stores */
  const user = useUserStore();
  const notifications = useNotificationsStore();

  onMounted(async () => {
    if (isLoggedInOrganization(user.selectedOrganization)) {
      await Promise.allSettled(notificationTypes.map(type => notifications.markAsRead(type)));
    }
  });

  onBeforeUnmount(async () => {
    if (isLoggedInOrganization(user.selectedOrganization)) {
      await Promise.allSettled(notificationTypes.map(type => notifications.markAsRead(type)));
    }
  });
}
