<script setup lang="ts">
import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRouter } from 'vue-router';

import { logout } from '@renderer/services/organization';

import Logo from '@renderer/components/Logo.vue';
import LogoText from '@renderer/components/LogoText.vue';
import UserModeSelect from './UserModeSelect.vue';

/* Mappings */
const networkMapping = {
  testnet: {
    label: 'TESTNET',
    className: 'text-testnet',
  },
  mainnet: {
    label: 'MAINNET',
    className: 'text-mainnet',
  },
  custom: {
    label: 'CUSTOM',
    className: 'text-info',
  },
};

/* Stores */
const user = useUserStore();
const networkStore = useNetworkStore();

/* Composables */
const router = useRouter();

/* Handlers */
const handleLogout = async () => {
  if (user.selectedOrganization) {
    const { id, nickname, serverUrl, key } = user.selectedOrganization;
    await logout(serverUrl);
    await user.selectOrganization({ id, nickname, serverUrl, key });
  } else {
    localStorage.removeItem('htx_user');

    await user.logout();

    user.keyPairs = [];
    user.recoveryPhrase = null;

    router.push({ name: 'login' });
  }
};
</script>

<template>
  <div class="container-header">
    <div class="container-logo">
      <Logo class="me-2" />
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
      <div class="me-5">
        <span class="text-bold" :class="networkMapping[networkStore.network].className">{{
          networkMapping[networkStore.network].label
        }}</span>
      </div>
      <div>
        <UserModeSelect />
      </div>
      <span
        v-if="
          (user.personal && user.personal.isLoggedIn && !user.selectedOrganization) ||
          (user.selectedOrganization && !user.selectedOrganization.loginRequired)
        "
        class="container-icon"
        data-testid="button-logout"
        @click="handleLogout"
      >
        <i class="text-icon-main bi bi-box-arrow-right"></i>
      </span>
    </div>
  </div>
</template>
