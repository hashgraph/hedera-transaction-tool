<script setup lang="ts">
import { RouterLink } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

/* Store */
const user = useUserStore();

/* Misc */
const menuItems = [
  {
    link: '/transactions',
    title: 'Transactions',
    icon: 'bi bi-arrow-left-right',
  },
  {
    link: '/accounts',
    title: 'Accounts',
    icon: 'bi bi-person',
  },
  {
    link: '/files',
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
    title: 'Contact List',
    icon: 'bi bi-book',
  },
  // {
  //   link: '/style-guide',
  //   title: 'Style Guide',
  //   icon: 'bi bi-feather',
  // },
];

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
        <RouterLink class="link-menu mt-2" :to="item.link">
          <i :class="item.icon"></i><span>{{ item.title }}</span></RouterLink
        >
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
