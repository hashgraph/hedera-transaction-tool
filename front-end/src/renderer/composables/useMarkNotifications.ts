import type { INotificationReceiver } from '@main/shared/interfaces';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { NotificationType } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNotificationsStore from '@renderer/stores/storeNotifications';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { isLoggedInOrganization } from '@renderer/utils';

export default function useMarkNotifications(notificationTypes: NotificationType[]) {
  /* Stores */
  const user = useUserStore();
  const notifications = useNotificationsStore();
  const network = useNetworkStore();

  /* State */
  const oldNotifications = ref<INotificationReceiver[]>([]);
  const notificationsKey = ref(user.selectedOrganization?.serverUrl || '');

  /* Computed */
  const networkFilteredNotifications = computed(() => {
    return (
      notifications.notifications[notificationsKey.value]?.filter(
        n =>
          !n.notification.additionalData?.network ||
          n.notification.additionalData.network === network.network,
      ) || []
    );
  });

  /* Functions */
  async function markAsRead() {
    if (isLoggedInOrganization(user.selectedOrganization)) {
      const typesToMark = [...new Set(
        networkFilteredNotifications.value
          .filter(nr => notificationTypes.includes(nr.notification.type))
          .map(nr => nr.notification.type)
      )];

      if (typesToMark.length > 0) {
        await Promise.allSettled(
          typesToMark.map(type => notifications.markAsRead(type)),
        );
      }
    }
  }

  /* retain the previous notifications to allow the indicators to be shown temporarily */
  function setOldNotifications(addPrevious = false) {
    const data =
      networkFilteredNotifications.value?.filter(nr =>
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
