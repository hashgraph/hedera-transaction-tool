<script setup lang="ts">
import { inject, nextTick } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';

import { useRouter } from 'vue-router';

import { logout } from '@renderer/services/organization';

import { GLOBAL_MODAL_LOADER_KEY, GLOBAL_MODAL_LOADER_TYPE } from '@renderer/providers';

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
  'local-node': {
    label: 'LOCAL NODE',
    className: 'text-info',
  },
};

/* Stores */
const user = useUserStore();
const networkStore = useNetworkStore();
const ws = useWebsocketConnection();

/* Composables */
const router = useRouter();

/* Injected */
const globalModalLoaderRef = inject<GLOBAL_MODAL_LOADER_TYPE>(GLOBAL_MODAL_LOADER_KEY);

/* Handlers */
const handleLogout = async () => {
  try {
    globalModalLoaderRef?.value?.open();

    if (user.selectedOrganization) {
      ws.setSocket(null);
      await nextTick();

      const { id, nickname, serverUrl, key } = user.selectedOrganization;
      await logout(serverUrl);
      globalModalLoaderRef?.value?.close();
      await user.selectOrganization({ id, nickname, serverUrl, key });
    } else {
      localStorage.removeItem('htx_user');

      await user.logout();
      globalModalLoaderRef?.value?.close();

      user.keyPairs = [];
      user.recoveryPhrase = null;

      router.push({ name: 'login' });
    }
  } finally {
    globalModalLoaderRef?.value?.close();
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
        <span
          class="text-bold text-small"
          :class="networkMapping[networkStore.network].className"
          >{{ networkMapping[networkStore.network].label }}</span
        >
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
