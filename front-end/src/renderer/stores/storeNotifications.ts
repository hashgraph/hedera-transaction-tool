import { ref } from 'vue';
import { defineStore } from 'pinia';

import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from '@renderer/services/organization';

import useUserStore from './storeUser';
import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils/userStoreHelpers';
import {
  INotificationReceiver,
  IUpdateNotificationPreferencesDto,
  IUpdateNotificationReceiver,
  NotificationType,
} from '@main/shared/interfaces';
import {
  getAllInAppNotifications,
  updateNotifications,
} from '@renderer/services/organization/notifications';

const useNotificationsStore = defineStore('notifications', () => {
  const user = useUserStore();

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
  }

  /** Preferences **/
  async function fetchPreferences() {
    if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

    if (isLoggedInOrganization(user.selectedOrganization)) {
      const userPreferences = await getUserNotificationPreferences(
        user.selectedOrganization?.serverUrl,
      );

      const newPreferences = { ...notificationsPreferences.value };

      for (const preference of userPreferences) {
        newPreferences[preference.type] = preference.email;
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

  async function markAsRead(type: NotificationType) {
    if (!isLoggedInOrganization(user.selectedOrganization)) {
      throw new Error('No organization selected');
    }

    const notificationIds = notifications.value
      .filter(nr => nr.notification.type === type)
      .map(nr => nr.id);
    const dtos = notificationIds.map((): IUpdateNotificationReceiver => ({ isRead: true }));

    await updateNotifications(user.selectedOrganization.serverUrl, notificationIds, dtos);

    await fetchNotifications();
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
