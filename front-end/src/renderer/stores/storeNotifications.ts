import type {
  INotificationReceiver,
  IUpdateNotificationPreferencesDto,
  IUpdateNotificationReceiver,
} from '@main/shared/interfaces';

import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { NotificationType } from '@main/shared/interfaces';
import { NOTIFICATIONS_INDICATORS_DELETE, NOTIFICATIONS_NEW } from '@main/shared/constants';

import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  getAllInAppNotifications,
  updateNotifications,
} from '@renderer/services/organization';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';

import useUserStore from './storeUser';
import useWebsocketConnection from './storeWebsocketConnection';
import useNetworkStore from './storeNetwork';

const useNotificationsStore = defineStore('notifications', () => {
  /* Stores */
  const network = useNetworkStore();
  const user = useUserStore();
  const ws = useWebsocketConnection();

  /* State */
  const notificationsPreferences = ref({
    [NotificationType.TRANSACTION_READY_FOR_EXECUTION]: true,
    [NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES]: true,
    [NotificationType.TRANSACTION_CANCELLED]: true,
  });
  const notifications = ref<{ [serverUrl: string]: INotificationReceiver[] }>({});

  /* Computed */
  const networkNotifications = computed(() => {
    const counts = { mainnet: 0, testnet: 0, previewnet: 0, 'local-node': 0, custom: 0 };

    if (notifications.value) {
      const allNotifications = { ...notifications.value };
      for (const serverUrl of Object.keys(allNotifications)) {
        allNotifications[serverUrl] = allNotifications[serverUrl].filter(n =>
          n.notification.type.toLocaleLowerCase().includes('indicator'),
        );
      }
      for (const serverUrl of Object.keys(allNotifications)) {
        for (const n of allNotifications[serverUrl]) {
          const network = n.notification.additionalData?.network;

          if (!network) {
            continue;
          }

          if (network in counts) {
            counts[network as keyof typeof counts]++;
          } else {
            counts['custom']++;
          }
        }
      }
    }
    return counts;
  });

  let notificationsQueue = Promise.resolve();

  /* Actions */
  async function setup() {
    await fetchPreferences();
    await fetchNotifications();
  }

  /** Preferences **/
  async function fetchPreferences() {
    if (!isUserLoggedIn(user.personal)) return;

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
    notificationsQueue = notificationsQueue.then(async () => {
      if (!isUserLoggedIn(user.personal)) return;

      const severUrls = user.organizations.map(o => o.serverUrl);
      const results = await Promise.allSettled(
        user.organizations.map(o => getAllInAppNotifications(o.serverUrl, true)),
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        result.status === 'fulfilled' && (notifications.value[severUrls[i]] = result.value);
      }
      notifications.value = {...notifications.value};
    });

    await notificationsQueue;
  }

  function listenForUpdates() {
    const severUrls = user.organizations.map(o => o.serverUrl);
    for (const severUrl of severUrls) {
      ws.on(severUrl, NOTIFICATIONS_NEW, e => {
        const newNotifications: INotificationReceiver[] = e;

        notifications.value[severUrl] = [...notifications.value[severUrl], ...newNotifications];
        notifications.value = { ...notifications.value };
      });

      ws.on(severUrl, NOTIFICATIONS_INDICATORS_DELETE, e => {
        if (!Array.isArray(e)) {
          e = [e];
        }
        const notificationReceiverIds = e.flatMap(item => item.notificationReceiverIds || []);

        notifications.value[severUrl] = notifications.value[severUrl].filter(
          nr => !notificationReceiverIds.includes(nr.id),
        );
        notifications.value = { ...notifications.value };
      });
    }
  }

  async function markAsRead(type: NotificationType) {
    if (!isLoggedInOrganization(user.selectedOrganization)) {
      throw new Error('No organization selected');
    }

    const notificationsKey = user.selectedOrganization?.serverUrl || '';
    if (!notificationsKey) return;

    const networkFilteredNotifications =
      notifications.value[notificationsKey].filter(
        n =>
          !n.notification.additionalData?.network ||
          n.notification.additionalData.network === network.network,
      ) || [];

    if (networkFilteredNotifications.length > 0) {
      const notificationIds = networkFilteredNotifications
        .filter(nr => nr.notification.type === type)
        .map(nr => nr.id );

      await _updateNotifications(notificationsKey, notificationIds);
    }
  }

  async function markAsReadIds(notificationIds: number[]) {
    if (!isLoggedInOrganization(user.selectedOrganization)) {
      throw new Error('No organization selected');
    }

    const notificationsKey = user.selectedOrganization?.serverUrl || '';
    if (!notificationsKey) return;

    await _updateNotifications(notificationsKey, notificationIds);
  }

  async function _updateNotifications(notificationsKey: string, notificationIds: number[]) {
    // Add the update to the queue
    notificationsQueue = notificationsQueue.then(async () => {
      const notificationsForKey = notifications.value[notificationsKey] || [];
      const notificationsToUpdate: IUpdateNotificationReceiver[] = notificationIds
        .filter(id => notificationsForKey.some(nr => nr.id === id))
        .map(id => ({ id, isRead: true }));

      if (notificationsToUpdate.length === 0) return;

      await updateNotifications(notificationsKey, notificationsToUpdate);
      notifications.value[notificationsKey] = notifications.value[notificationsKey].filter(
        nr => !notificationIds.includes(nr.id),
      );
      notifications.value = {...notifications.value};
    });

    // Wait for the current update to complete
    await notificationsQueue;
  }

  ws.$onAction(ctx => {
    if (ctx.name === 'setup') {
      ctx.after(() => listenForUpdates());
    }
  });

  return {
    notificationsPreferences,
    notifications,
    setup,
    fetchPreferences,
    fetchNotifications,
    updatePreferences,
    markAsRead,
    markAsReadIds,
    networkNotifications,
  };
});

export default useNotificationsStore;
