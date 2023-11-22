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
    <template v-for="(item, index) in menuItems" :key="index">
      <RouterLink class="link-menu mt-2" :to="item.link">
        <i :class="item.icon"></i><span>{{ item.title }}</span></RouterLink
      >
    </template>
  </div>
</template>
