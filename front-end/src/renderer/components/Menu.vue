<script setup lang="ts">
import { computed } from 'vue';

import { NotificationType } from '@main/shared/interfaces';

import { RouterLink } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';
import useNotificationsStore from '@renderer/stores/storeNotifications';

import { isLoggedInOrganization } from '@renderer/utils';

/* Types */
type MenuItem = {
  link: string;
  testid: string;
  title: string;
  icon: string;
  notifications?: number;
};

/* Store */
const user = useUserStore();
const notifications = useNotificationsStore();

/* Computed */
const menuItems = computed<MenuItem[]>(() => {
  const items = getMenuItems();
  const notificationsKey = user.selectedOrganization?.serverUrl || '';
  const indicatorNotifications = getIndicatorNotifications(notificationsKey);

  const transactions = items.find(i => i.link === '/transactions');
  if (transactions) {
    transactions.notifications = indicatorNotifications.length;
  }

  return items;
});

/* Functions */
const getMenuItems = (): MenuItem[] => [
  {
    link: '/transactions',
    testid: 'button-menu-transactions',
    title: 'Transactions',
    icon: 'bi bi-arrow-left-right',
  },
  {
    link: '/accounts',
    testid: 'button-menu-accounts',
    title: 'Accounts',
    icon: 'bi bi-person',
  },
  {
    link: '/files',
    testid: 'button-menu-files',
    title: 'Files',
    icon: 'bi bi-file-text',
  },
  // {
  //   link: '/tokens',
  //   title: 'Tokens',
  //   icon: 'bi bi-coin',
  // },
  // {
  //   link: '/smart-contracts',
  //   title: 'Smart Contracts',
  //   icon: 'bi bi-arrows-angle-contract',
  // },
  // {
  //   link: '/consensus-service',
  //   title: 'Consensus Service',
  //   icon: 'bi bi-shield-check',
  // },
  {
    link: '/contact-list',
    testid: 'button-contact-list',
    title: 'Contact List',
    icon: 'bi bi-book',
  },
  // {
  //   link: '/style-guide',
  //   title: 'Style Guide',
  //   icon: 'bi bi-feather',
  // },
];

const getIndicatorNotifications = (notificationsKey: string) =>
  notifications.notifications[notificationsKey]?.filter(nr =>
    [
      NotificationType.TRANSACTION_INDICATOR_APPROVE,
      NotificationType.TRANSACTION_INDICATOR_SIGN,
      NotificationType.TRANSACTION_INDICATOR_EXECUTABLE,
      NotificationType.TRANSACTION_INDICATOR_EXECUTED,
      NotificationType.TRANSACTION_INDICATOR_EXPIRED,
    ].includes(nr.notification.type),
  ) || [];

/* Misc */
const organizationOnly = ['/contact-list'];
</script>

<template>
  <div class="container-menu">
    <div>
      <template
        v-for="(item, _index) in menuItems.filter(
          i =>
            !organizationOnly.includes(i.link) || isLoggedInOrganization(user.selectedOrganization),
        )"
        :key="_index"
      >
        <RouterLink class="link-menu mt-2" :to="item.link" :data-testid="item.testid">
          <i :class="item.icon"></i>
          <span>{{ item.title }}</span>
          <span
            v-if="item.notifications"
            :data-testid="`span-menu-${item.title}-notification-number`"
            class="notification rounded-circle bg-danger text-white ms-3"
            >{{ item.notifications.toFixed(0) }}</span
          >
        </RouterLink>
      </template>
    </div>

    <div>
      <RouterLink
        data-testid="button-menu-settings"
        class="link-menu mt-2"
        to="/settings/general"
        :class="{ active: $route.path.startsWith('/settings') }"
        ><i class="bi bi-gear"></i><span>Settings</span></RouterLink
      >
      <!-- <RouterLink class="link-menu mt-2" to="/help"
        ><i class="bi bi-question-circle"></i><span>Help</span></RouterLink
      > -->
    </div>
  </div>
</template>
