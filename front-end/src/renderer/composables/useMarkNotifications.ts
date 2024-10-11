import type { INotificationReceiver } from '@main/shared/interfaces';

import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { NotificationType } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNotificationsStore from '@renderer/stores/storeNotifications';

import { isLoggedInOrganization } from '@renderer/utils';

export default function useMarkNotifications(notificationTypes: NotificationType[]) {
  /* Stores */
  const user = useUserStore();
  const notifications = useNotificationsStore();

  /* State */
  const oldNotifications = ref<INotificationReceiver[]>([]);

  /* Functions */
  async function markAsRead() {
    if (isLoggedInOrganization(user.selectedOrganization)) {
      await Promise.allSettled(notificationTypes.map(type => notifications.markAsRead(type)));
    }
  }

  function setOldNotifications(addPrevious = false) {
    const notificationsKey = user.selectedOrganization?.serverUrl || '';
    const data =
      notifications.notifications[notificationsKey]?.filter(nr =>
        notificationTypes.includes(nr.notification.type),
      ) || [];

    if (addPrevious) {
      oldNotifications.value = oldNotifications.value.concat(data);
    } else {
      oldNotifications.value = data;
    }
  }

  /* Hooks */
  onMounted(async () => {
    setOldNotifications(true);
    await markAsRead();
  });

  onBeforeUnmount(async () => {
    await markAsRead();
  });

  /* Watchers */
  watch(
    () => user.selectedOrganization,
    async organization => {
      if (isLoggedInOrganization(organization)) {
        setOldNotifications(false);
        await markAsRead();
      }
    },
  );
  return { oldNotifications };
}
