import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { INotificationReceiver, NotificationType } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNotificationsStore from '@renderer/stores/storeNotifications';

import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

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

  /* Hooks */
  onMounted(async () => {
    oldNotifications.value = notifications.notifications.filter(nr =>
      notificationTypes.includes(nr.notification.type),
    );

    await markAsRead();
  });

  onBeforeUnmount(async () => {
    await markAsRead();
  });

  /* Watchers */
  watch(
    () => user.selectedOrganization,
    async (organization, oldOrganization) => {
      if (
        isLoggedInOrganization(organization) &&
        oldOrganization?.serverUrl !== organization.serverUrl
      ) {
        oldNotifications.value = notifications.notifications.filter(nr =>
          notificationTypes.includes(nr.notification.type),
        );

        await markAsRead();
      }
    },
  );

  return { oldNotifications };
}
