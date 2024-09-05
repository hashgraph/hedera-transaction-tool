import type {
  INotificationReceiver,
  IUpdateNotificationPreferencesDto,
  IUpdateNotificationReceiver,
} from '@main/shared/interfaces';

import { ref } from 'vue';
import { defineStore } from 'pinia';

import { NOTIFICATIONS_INDICATORS_DELETE, NOTIFICATIONS_NEW } from '@main/shared/constants';

import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from '@renderer/services/organization';

import useUserStore from './storeUser';
import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils/userStoreHelpers';
import { NotificationType } from '@main/shared/interfaces';
import {
  getAllInAppNotifications,
  updateNotifications,
} from '@renderer/services/organization/notifications';
import useWebsocketConnection from './storeWebsocketConnection';

const useNotificationsStore = defineStore('notifications', () => {
  const user = useUserStore();
  const ws = useWebsocketConnection();

  /* State */
  const notificationsPreferences = ref({
    [NotificationType.TRANSACTION_READY_FOR_EXECUTION]: true,
    [NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES]: true,
  });
  const notifications = ref<INotificationReceiver[]>([]);

  /* Actions */
  async function setup() {
    await fetchPreferences();
    await fetchNotifications();
    await listenForUpdates();
  }

  /** Preferences **/
  async function fetchPreferences() {
    if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

    if (isLoggedInOrganization(user.selectedOrganization)) {
      const userPreferences = await getUserNotificationPreferences(
        user.selectedOrganization?.serverUrl,
      );

      const newPreferences = { ...notificationsPreferences.value };

      for (const preference of userPreferences.filter(p => p.type in newPreferences)) {
        newPreferences[preference.type as keyof typeof newPreferences] = preference.email;
      }

      notificationsPreferences.value = newPreferences;
    }
  }

  async function updatePreferences(data: IUpdateNotificationPreferencesDto) {
    if (!isLoggedInOrganization(user.selectedOrganization)) {
      throw new Error('No organization selected');
    }

    const newPreferences = await updateUserNotificationPreferences(
      user.selectedOrganization.serverUrl,
      data,
    );

    notificationsPreferences.value = {
      ...notificationsPreferences.value,
      [newPreferences.type]: newPreferences.email,
    };
  }

  /** Notifications **/
  async function fetchNotifications() {
    if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

    if (isLoggedInOrganization(user.selectedOrganization)) {
      const newNotifications = await getAllInAppNotifications(
        user.selectedOrganization.serverUrl,
        true,
      );
      notifications.value = newNotifications;
    } else {
      notifications.value = [];
    }
  }

  async function listenForUpdates() {
    ws.on(NOTIFICATIONS_NEW, async e => {
      const notification: INotificationReceiver = e.data;
      notifications.value = [...notifications.value, notification];
    });

    ws.on(NOTIFICATIONS_INDICATORS_DELETE, async e => {
      const notificationReceiverIds: number[] = e.data.notificationReceiverIds;
      notifications.value = notifications.value.filter(
        nr => !notificationReceiverIds.includes(nr.id),
      );
    });
  }

  async function markAsRead(type: NotificationType) {
    if (!isLoggedInOrganization(user.selectedOrganization)) {
      throw new Error('No organization selected');
    }

    const notificationIds = notifications.value
      .filter(nr => nr.notification.type === type)
      .map(nr => nr.id);
    const dtos = notificationIds.map((): IUpdateNotificationReceiver => ({ isRead: true }));

    await updateNotifications(user.selectedOrganization.serverUrl, notificationIds, dtos);

    notifications.value = notifications.value.filter(nr => !notificationIds.includes(nr.id));
  }

  return {
    notificationsPreferences,
    notifications,
    setup,
    fetchPreferences,
    fetchNotifications,
    updatePreferences,
    markAsRead,
  };
});

export default useNotificationsStore;
