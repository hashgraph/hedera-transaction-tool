import { ref } from 'vue';
import { defineStore } from 'pinia';

import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from '@renderer/services/organization';

import useUserStore from './storeUser';
import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';
import {
  INotificationPreferencesCore,
  IUpdateNotificationPreferencesDto,
  NotificationType,
} from '@main/shared/interfaces';

const useNotificationsStore = defineStore('notifications', () => {
  const user = useUserStore();

  /* State */
  const notificationsPreferences = ref({
    [NotificationType.TRANSACTION_READY_FOR_EXECUTION]: true,
    [NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES]: true,
  });

  /* Actions */
  async function fetchPreferences() {
    if (!isLoggedInOrganization(user.selectedOrganization)) {
      throw new Error('No organization selected');
    }

    const preferences = await getUserNotificationPreferences(user.selectedOrganization?.serverUrl);

    updatePreference(preferences);
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

  function updatePreference(preferences: INotificationPreferencesCore[]) {
    const newPreferences = { ...notificationsPreferences.value };

    for (const preference of preferences) {
      newPreferences[preference.type] = preference.email;
    }

    notificationsPreferences.value = newPreferences;
  }

  return {
    notificationsPreferences,
    fetchPreferences,
    updatePreferences,
  };
});

export default useNotificationsStore;
