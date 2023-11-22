<script setup lang="ts">
import { RouterLink } from 'vue-router';
import AppIcon from './AppIcon.vue';

const menuItems = [
  {
    link: '/',
    title: 'Style Guide',
    icon: 'user',
  },
  {
    link: '/transactions',
    title: 'Transactions',
    icon: 'arrowSwapHorizontal',
  },
  {
    link: '/accounts',
    title: 'Accounts',
    icon: 'user',
  },
  {
    link: '/tokens',
    title: 'Tokens',
    icon: 'token',
  },
];
</script>

<template>
  <div class="container-menu">
    <template v-for="(item, index) in menuItems" :key="index">
      <RouterLink class="link-menu" :to="item.link">
        <AppIcon class="me-3" :title="item.icon" /><span>{{ item.title }}</span></RouterLink
      >
    </template>
  </div>
</template>
