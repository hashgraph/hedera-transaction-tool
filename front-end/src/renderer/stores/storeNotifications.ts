import { reactive } from 'vue';
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
} from '@main/shared/interfaces';

const useNotificationsStore = defineStore('notifications', () => {
  const user = useUserStore();

  /* State */
  const notifications = reactive({
    'threshold-reached': true,
    'required-signatures': true,
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

    updatePreference(newPreferences);
  }

  function updatePreference(preferences: INotificationPreferencesCore) {
    notifications['threshold-reached'] = preferences.transactionReadyForExecution;
    notifications['required-signatures'] = preferences.transactionRequiredSignature;
  }

  return {
    notifications,
    fetchPreferences,
    updatePreferences,
  };
});

export default useNotificationsStore;
