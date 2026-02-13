import type { INotificationReceiver } from '@shared/interfaces';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { NotificationType } from '@shared/interfaces';

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

  const filteredByType = computed(() =>
    notificationTypes.length === 0
      ? []
      : networkFilteredNotifications.value.filter(nr =>
        notificationTypes.includes(nr.notification.type),
      ),
  );

  /* Functions */
  async function markAsRead() {
    if (
      notificationTypes.length === 0 ||
      !isLoggedInOrganization(user.selectedOrganization)
    ) {
      return;
    }

    const typesToMark = [
      ...new Set(filteredByType.value.map(nr => nr.notification.type)),
    ];

    if (typesToMark.length === 0) {
      return;
    }

    await Promise.allSettled(
      typesToMark.map(type => notifications.markAsRead(type)),
    );
  }

  /* retain the previous notifications to allow the indicators to be shown temporarily */
  function setOldNotifications(addPrevious = false) {
    if (notificationTypes.length === 0) {
      oldNotifications.value = addPrevious ? oldNotifications.value : [];
      return;
    }

    const data = filteredByType.value;

    oldNotifications.value = addPrevious
      ? oldNotifications.value.concat(data)
      : data;
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
