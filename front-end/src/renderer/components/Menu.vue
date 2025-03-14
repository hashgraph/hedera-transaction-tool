<script setup lang="ts">
import { RouterLink } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

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

/* Misc */
const organizationOnly = ['/contact-list'];
</script>

<template>
  <div class="container-menu">
    <div>
      <template
        v-for="(item, _index) in getMenuItems().filter(
          i =>
            !organizationOnly.includes(i.link) || isLoggedInOrganization(user.selectedOrganization),
        )"
        :key="_index"
      >
        <RouterLink
          class="link-menu mt-2"
          :to="item.link"
          draggable="false"
          :data-testid="item.testid"
          ><i :class="item.icon"></i>
          <span>{{ item.title }}</span>
        </RouterLink>
      </template>
    </div>

    <div>
      <RouterLink
        class="link-menu mt-2"
        to="/settings/general"
        :class="{ active: $route.path.startsWith('/settings') }"
        draggable="false"
        data-testid="button-menu-settings"
        ><i class="bi bi-gear"></i><span>Settings</span></RouterLink
      >
    </div>
  </div>
</template>
