import type {
  INotificationReceiver,
  IUpdateNotificationPreferencesDto,
  IUpdateNotificationReceiver,
} from '@shared/interfaces';

import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';

import { NotificationType } from '@shared/interfaces';
import { NOTIFICATIONS_INDICATORS_DELETE, NOTIFICATIONS_NEW } from '@shared/constants';

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
import type { ConnectedOrganization } from '@renderer/types';

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

  const loggedInOrganization = computed((): ConnectedOrganization | null => {
    if (isUserLoggedIn(user.personal) && isLoggedInOrganization(user.selectedOrganization)) {
      return user.selectedOrganization;
    }
    return null;
  });

  const organizationServerUrls = computed(() => {
    if (isUserLoggedIn(user.personal)) {
      return user.organizations.map(o => o.serverUrl);
    }
    return [];
  });

  const currentNotificationsKey = computed(() => {
    if (!isLoggedInOrganization(user.selectedOrganization)) return '';
    return user.selectedOrganization!.serverUrl;
  });

  const currentOrganizationNotifications = computed<INotificationReceiver[]>(() => {
    const key = currentNotificationsKey.value;
    if (!key) return [];

    const allForOrg = notifications.value[key] || [];

    // keep the same network filter behavior as in markAsRead
    return allForOrg.filter(n =>
      !n.notification.additionalData?.network ||
      n.notification.additionalData.network === network.network,
    );
  });

  let notificationsQueue = Promise.resolve();

  /** Preferences **/
  async function fetchPreferences() {
    if (loggedInOrganization.value !== null) {
      const userPreferences = await getUserNotificationPreferences(
        loggedInOrganization.value.serverUrl,
      );

      const newPreferences = { ...notificationsPreferences.value };

      for (const preference of userPreferences.filter(p => p.type in newPreferences)) {
        newPreferences[preference.type as keyof typeof newPreferences] = preference.email;
      }

      notificationsPreferences.value = newPreferences;
    }
  }

  async function updatePreferences(data: IUpdateNotificationPreferencesDto) {
    if (loggedInOrganization.value === null) {
      throw new Error('No organization selected');
    }

    const newPreferences = await updateUserNotificationPreferences(
      loggedInOrganization.value.serverUrl,
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
      const severUrls = organizationServerUrls.value;
      const results = await Promise.allSettled(
        user.organizations.map(o => getAllInAppNotifications(o.serverUrl, true)),
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        result.status === 'fulfilled' && (notifications.value[severUrls[i]] = result.value);
      }
      notifications.value = { ...notifications.value };
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
        const deleteNotifications: {notificationReceiverIds: number}[] = e;
        const notificationReceiverIds = deleteNotifications.flatMap(item => item.notificationReceiverIds || []);

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

    const notificationsKey = currentNotificationsKey.value;
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
        .map(nr => nr.id);

      await _updateNotifications(notificationsKey, notificationIds);
    }
  }

  async function markAsReadIds(notificationIds: number[]) {
    if (!isLoggedInOrganization(user.selectedOrganization)) {
      throw new Error('No organization selected');
    }

    const notificationsKey = currentNotificationsKey.value;
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
      notifications.value = { ...notifications.value };
    });

    // Wait for the current update to complete
    await notificationsQueue;
  }

  ws.$onAction(ctx => {
    if (ctx.name === 'setup') {
      ctx.after(() => listenForUpdates());
    }
  });

  /* Watchers */
  watch(loggedInOrganization, async () => await fetchPreferences(), { immediate: true });
  watch(organizationServerUrls, async () => await fetchNotifications(), { immediate: true });

  return {
    notificationsPreferences,
    notifications,
    currentOrganizationNotifications,
    updatePreferences,
    markAsRead,
    markAsReadIds,
    networkNotifications,
  };
});

export default useNotificationsStore;
