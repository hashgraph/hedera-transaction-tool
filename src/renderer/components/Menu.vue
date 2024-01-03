<script setup lang="ts">
import { RouterLink } from 'vue-router';

const menuItems = [
  {
    link: '/',
    title: 'Start',
    icon: 'bi bi-flag',
  },
  {
    link: '/style-guide',
    title: 'Style Guide',
    icon: 'bi bi-feather',
  },
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
  // {
  //   link: '/tokens',
  //   title: 'Tokens',
  //   icon: 'bi bi-database',
  // },
  // {
  //   link: '/smart-contracts',
  //   title: 'Smart Contracts',
  //   icon: 'bi bi-code-slash',
  // },
  // {
  //   link: '/consensus-service',
  //   title: 'Consensus Service',
  //   icon: 'bi bi-house-door',
  // },
  // {
  //   link: '/file-service',
  //   title: 'File Service',
  //   icon: 'bi bi-file-earmark',
  // },
  // {
  //   link: '/contact-list',
  //   title: 'Contact List',
  //   icon: 'bi bi-book',
  // },
];
</script>

<template>
  <div class="container-menu">
    <div>
      <template v-for="(item, index) in menuItems" :key="index">
        <RouterLink class="link-menu mt-2" :to="item.link">
          <i :class="item.icon"></i><span>{{ item.title }}</span></RouterLink
        >
      </template>
    </div>

    <div>
      <RouterLink
        class="link-menu mt-2"
        to="/settings/general"
        :class="{ active: $route.path.startsWith('/settings') }"
        ><i class="bi bi-wrench"></i><span>Settings</span></RouterLink
      >
      <RouterLink class="link-menu mt-2" to="/help"
        ><i class="bi bi-question-circle"></i><span>Help</span></RouterLink
      >
    </div>
  </div>
</template>
