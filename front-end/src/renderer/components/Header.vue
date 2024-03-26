<script setup lang="ts">
import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { useRouter } from 'vue-router';

import Logo from '@renderer/components/Logo.vue';
import LogoText from '@renderer/components/LogoText.vue';
import UserModeSelect from './UserModeSelect.vue';

/* Stores */
const user = useUserStore();
const keyPairsStore = useKeyPairsStore();

/* Composables */
const router = useRouter();

/* Handlers */
const handleLogout = () => {
  localStorage.removeItem('htx_user');

  user.logout();

  keyPairsStore.clearKeyPairs();
  keyPairsStore.clearRecoveryPhrase();

  router.push({ name: 'login' });
};
</script>

<template>
  <div class="container-header">
    <div class="container-logo">
      <Logo />
      <LogoText />
    </div>
    <div v-if="user.data.isLoggedIn" class="flex-centered justify-content-end">
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
      <span v-if="user.data.isLoggedIn" class="container-icon" @click="handleLogout">
        <i class="text-icon-main bi bi-box-arrow-right"></i>
      </span>
    </div>
  </div>
</template>
