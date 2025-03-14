import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { NotificationType } from '@main/shared/interfaces';
import { readyToSignTitle, historyTitle, readyForExecutionTitle } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useNotificationsStore from '@renderer/stores/storeNotifications';

import { getNetworkLabel } from '@renderer/utils';

/* Types */
interface GroupedNotificationInfo {
  content: string;
  type: NotificationType;
  network: string;
  networkRaw: string;
  count: number;
}

interface GroupedNotification extends GroupedNotificationInfo {
  action: () => void;
}

export function useGroupedNotifications() {
  /* Stores */
  const user = useUserStore();
  const network = useNetworkStore();
  const notificationsStore = useNotificationsStore();

  /* Composables */
  const router = useRouter();

  /* Computed */
  const groupedNotifications = computed(() => {
    const grouped: Record<string, Record<string, GroupedNotification[]>> = {};

    for (const [serverUrl, notificationReceivers] of Object.entries(
      notificationsStore.notifications,
    )) {
      const nicknamedServerUrl =
        user.organizations.find(o => o.serverUrl === serverUrl)?.nickname || serverUrl;
      grouped[nicknamedServerUrl] = {};

      for (const notification of notificationReceivers) {
        if (notification.isRead) continue;

        const serverGroup = grouped[nicknamedServerUrl];
        const network = notification.notification.additionalData?.network || 'Unknown';
        const type = notification.notification.type;

        // Initialize array for this network if it doesn't exist
        if (!serverGroup[network]) {
          serverGroup[network] = [];
        }

        // Check if a notification of the same type already exists
        const existingNotificationIndex = serverGroup[network].findIndex(
          item => item.type === type,
        );

        if (existingNotificationIndex !== -1) {
          // Increment count for existing notification type
          const existing = serverGroup[network][existingNotificationIndex];
          const newCount = existing.count + 1;
          serverGroup[network][existingNotificationIndex].count = newCount;
          // Update content with plural form if count > 1
          serverGroup[network][existingNotificationIndex].content = getContentFromType(
            type,
            newCount,
          );
        } else {
          // Add new notification type to the group
          const info: GroupedNotificationInfo = {
            content: getContentFromType(type, 1),
            type,
            network: getNetworkLabel(network),
            networkRaw: network,
            count: 1,
          };

          serverGroup[network].push({
            ...info,
            action: getActionFromGroupItem(info, serverUrl),
          });
        }
      }
    }

    return grouped;
  });

  const totalCount = computed(() => {
    let total = 0;

    for (const serverGroup of Object.values(groupedNotifications.value)) {
      for (const networkGroup of Object.values(serverGroup)) {
        for (const notification of networkGroup) {
          total += notification.count;
        }
      }
    }

    return total;
  });

  /* Functions */
  const getContentFromType = (type: NotificationType, count: number) => {
    const suffix = count > 1 ? 's' : '';

    switch (type) {
      case NotificationType.TRANSACTION_INDICATOR_EXECUTABLE:
        return `Transaction${suffix} ready for execution`;
      case NotificationType.TRANSACTION_INDICATOR_APPROVE:
        return `Transaction${suffix} ready for approval`;
      case NotificationType.TRANSACTION_APPROVED:
        return `Transaction${suffix} approved`;
      case NotificationType.TRANSACTION_INDICATOR_EXECUTED:
        return `Transaction${suffix} executed successfully`;
      case NotificationType.TRANSACTION_INDICATOR_FAILED:
        return `Transaction${suffix} failed`;
      case NotificationType.TRANSACTION_INDICATOR_EXPIRED:
        return `Transaction${suffix} expired`;
      case NotificationType.TRANSACTION_APPROVAL_REJECTION:
        return `Transaction${suffix} rejected`;
      case NotificationType.TRANSACTION_INDICATOR_CANCELLED:
        return `Transaction${suffix} cancelled`;
      case NotificationType.TRANSACTION_INDICATOR_ARCHIVED:
        return `Transaction${suffix} archived`;
      case NotificationType.USER_REGISTERED:
        return `User${suffix} registered`;
      case NotificationType.TRANSACTION_INDICATOR_SIGN:
        return `Transaction${suffix} ready to sign`;
      default:
        return '';
    }
  };

  const getActionFromGroupItem = (notification: GroupedNotificationInfo, serverUrl: string) => {
    const selectOrganization = async () => {
      const currentServerUrl = user.selectedOrganization?.serverUrl;
      if (currentServerUrl !== serverUrl) {
        const organization = user.organizations.find(o => o.serverUrl === serverUrl);
        if (organization) {
          await user.selectOrganization(organization);
        }
      }

      if (network.network !== notification.network) {
        await network.setNetwork(notification.networkRaw);
      }
    };

    switch (notification.type) {
      case NotificationType.TRANSACTION_INDICATOR_EXECUTABLE:
        return async () => {
          await selectOrganization();
          await router.push({ name: 'transactions', query: { tab: readyForExecutionTitle } });
        };
      case NotificationType.TRANSACTION_INDICATOR_SIGN:
        return async () => {
          await selectOrganization();
          await router.push({ name: 'transactions', query: { tab: readyToSignTitle } });
        };
      case NotificationType.TRANSACTION_INDICATOR_CANCELLED:
      case NotificationType.TRANSACTION_INDICATOR_EXECUTED:
      case NotificationType.TRANSACTION_INDICATOR_EXPIRED:
      case NotificationType.TRANSACTION_INDICATOR_FAILED:
        return async () => {
          await selectOrganization();
          await router.push({ name: 'transactions', query: { tab: historyTitle } });
        };
      case NotificationType.TRANSACTION_APPROVED:
      case NotificationType.TRANSACTION_APPROVAL_REJECTION:
        return () => {};
      case NotificationType.USER_REGISTERED:
        return async () => {
          await router.push({ name: 'contactList' });
        };
      default:
        return () => {};
    }
  };

  return {
    groupedNotifications,
    totalCount,
  };
}
