<script setup lang="ts">
import { RouterLink } from 'vue-router';

const menuItems = [
  {
    link: '/',
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
  {
    link: '/tokens',
    title: 'Tokens',
    icon: 'bi bi-database',
  },
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
      <RouterLink class="link-menu mt-2" to="/settings"
        ><i class="bi bi-wrench"></i><span>Settings</span></RouterLink
      >
      <RouterLink class="link-menu mt-2" to="/help"
        ><i class="bi bi-question-circle"></i><span>Help</span></RouterLink
      >
    </div>
  </div>
</template>
