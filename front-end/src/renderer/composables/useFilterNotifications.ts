import { computed, onMounted, ref, type Ref, watch } from 'vue';
import { type INotificationReceiver, NotificationType } from '@shared/interfaces';
import type { ITransactionNode } from '../../../../shared/src/ITransactionNode.ts';
import type { ConnectedOrganization } from '@renderer/types';
import { getTransactionById } from '@renderer/services/organization';
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
    } else if (transactionNode.value.groupId && user.selectedOrganization) {
      // We monitor notifications for a group
      await updateFilteredNotificationsForGroup(transactionNode.value.groupId, user.selectedOrganization);
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
    organization: ConnectedOrganization,
  ) => {
    const serverUrl = organization.serverUrl;
    const newCandidates = [];
    for (const n of candidateNotifications.value) {
      // We fetch info for associated transaction and check its groupId
      // TODO: fetch from a cache
      if (n.notification.entityId) {
        try {
          const transaction = await getTransactionById(serverUrl, n.notification.entityId);
          if (transaction.groupItem.groupId === groupId) {
            newCandidates.push(n);
          }
        } catch {
          // User has probably not access to this transaction
          // => we ignore silently
        }
      }
    }
    filteredNotifications.value = newCandidates;
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
