<script setup lang="ts">
import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';

import Logo from '@renderer/components/Logo.vue';
import LogoText from '@renderer/components/LogoText.vue';
import UserModeSelect from './UserModeSelect.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();

/* Handlers */
const handleLogout = async () => {
  localStorage.removeItem('htx_user');

  await user.logout();

  user.keyPairs = [];
  user.recoveryPhrase = null;

  router.push({ name: 'login' });
};
</script>

<template>
  <div class="container-header">
    <div class="container-logo">
      <Logo />
      <LogoText />
    </div>
    <div v-if="user.personal && user.personal.isLoggedIn" class="flex-centered justify-content-end">
      <!-- <span class="container-icon">
        <i class="text-icon-main bi bi-search"></i>
      </span>
      <span class="container-icon">
        <i class="text-icon-main bi bi-bell"></i>
      </span>
      <span class="container-icon">
        <i class="text-icon-main bi bi-three-dots-vertical"></i>
      </span> -->
      <div>
        <UserModeSelect />
      </div>
      <span
        v-if="user.personal && user.personal.isLoggedIn"
        class="container-icon"
        @click="handleLogout"
      >
        <i class="text-icon-main bi bi-box-arrow-right"></i>
      </span>
    </div>
  </div>
</template>
