import { computed, onMounted, ref, type Ref, watch } from 'vue';
import { type INotificationReceiver, NotificationType } from '@shared/interfaces';
import type { ITransactionNode } from '../../../../shared/src/ITransactionNode.ts';
import useUserStore from '@renderer/stores/storeUser.ts';
import useNotificationsStore from '@renderer/stores/storeNotifications.ts';

export default function useFilterNotifications(
  transactionNode: Ref<ITransactionNode>,
  notificationTypes: Ref<NotificationType[]>,
) {

  /* Stores */
  const user = useUserStore();
  const notifications = useNotificationsStore();

  /* States */
  const filteredNotifications = ref<INotificationReceiver[]>([]);

  /* Computed */
  const filteredNotificationIds = computed(() => {
    return filteredNotifications.value.map(candidate => candidate.id);
  });

  const notificationsKey = computed(() => user.selectedOrganization?.serverUrl ?? '');

  const candidateNotifications = computed(() => {
    let result: INotificationReceiver[];
    if (notificationTypes.value.length > 0) {
      const serverNotifications = notifications.notifications[notificationsKey.value] ?? [];
      result = serverNotifications.filter((n: INotificationReceiver) => {
        return notificationTypes.value.includes(n.notification.type);
      });
    } else {
      result = [];
    }
    return result;
  });

  /* Functions */
  const updateFilteredNotifications = async () => {
    if (transactionNode.value.transactionId) {
      // We monitor notifications for a transaction
      updateFilteredNotificationsForTransaction(transactionNode.value.transactionId);
    } else if (transactionNode.value.groupId) {
      // We monitor notifications for a group
      await updateFilteredNotificationsForGroup(transactionNode.value.groupId);
    } else {
      // Safety code
      filteredNotifications.value = [];
    }
  };

  const updateFilteredNotificationsForTransaction = (transactionId: number): void => {
    filteredNotifications.value = candidateNotifications.value.filter(
      (n: INotificationReceiver) => {
        return n.notification.entityId === transactionId;
      },
    );
  };

  const updateFilteredNotificationsForGroup = async (
    groupId: number,
  ) => {
    filteredNotifications.value = candidateNotifications.value.filter(
      (n: INotificationReceiver) => {
        const notificationGroupId = n.notification.additionalData?.groupId;
        return notificationGroupId === groupId;
      },
    );
  };

  /* Mount */
  onMounted(() => {
    watch(
      [user.selectedOrganization, notifications.notifications, transactionNode, notificationTypes],
      updateFilteredNotifications,
      { immediate: true },
    );
  });

  return {
    filteredNotifications,
    filteredNotificationIds,
  };
}
