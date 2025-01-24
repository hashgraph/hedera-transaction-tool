<script setup lang="ts">
import type { Network } from '@main/shared/interfaces';

import { computed, onUpdated } from 'vue';

import { CommonNetwork } from '@main/shared/enums';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRouter } from 'vue-router';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';
import useLoader from '@renderer/composables/useLoader';

import { logout } from '@renderer/services/organization';
import { updateOrganizationCredentials } from '@renderer/services/organizationCredentials';

import {
  isLoggedInOrganization,
  isUserLoggedIn,
  normalizeNetworkName,
  toggleAuthTokenInSessionStorage,
} from '@renderer/utils';

import Logo from '@renderer/components/Logo.vue';
import LogoText from '@renderer/components/LogoText.vue';
import UserModeSelect from './UserModeSelect.vue';
import useNotificationsStore from '@renderer/stores/storeNotifications';

/* Mappings */
const networkMapping: {
  [key in Network]: { label: string; className: string };
} = {
  [CommonNetwork.TESTNET]: {
    label: 'TESTNET',
    className: 'text-testnet',
  },
  [CommonNetwork.MAINNET]: {
    label: 'MAINNET',
    className: 'text-mainnet',
  },
  [CommonNetwork.PREVIEWNET]: {
    label: 'PREVIEWNET',
    className: 'text-previewnet',
  },
  [CommonNetwork.LOCAL_NODE]: {
    label: 'LOCAL NODE',
    className: 'text-info',
  },
};

/* Stores */
const user = useUserStore();
const networkStore = useNetworkStore();
const notificationsStore = useNotificationsStore();

/* Composables */
const router = useRouter();
const createTooltips = useCreateTooltips();
const withLoader = useLoader();

/* Computed */
const hasIndicator = computed(() => {
  const currentNetwork = normalizeNetworkName(networkStore.network);
  return Object.entries(notificationsStore.networkNotifications)
    .filter(([key]) => key !== currentNetwork)
    .some(([, value]) => Boolean(value));
});

/* Handlers */
const handleLogout = async () => {
  if (user.selectedOrganization) {
    if (!isUserLoggedIn(user.personal)) return;

    const { id, nickname, serverUrl, key } = user.selectedOrganization;
    await logout(serverUrl);
    await updateOrganizationCredentials(id, user.personal.id, undefined, undefined, null);
    toggleAuthTokenInSessionStorage(serverUrl, '', true);
    await user.selectOrganization({ id, nickname, serverUrl, key });
  } else {
    localStorage.removeItem('htx_user');
    user.logout();
    await router.push({ name: 'login' });
  }
};

/* Hooks */
onUpdated(createTooltips);
</script>

<template>
  <div class="container-header">
    <div class="container-logo">
      <Logo class="me-2" />
      <LogoText />
    </div>
    <div
      v-if="user.personal && user.personal.isLoggedIn && !user.migrating"
      class="flex-centered justify-content-end"
    >
      <!-- <span class="container-icon">
        <i class="text-icon-main bi bi-search"></i>
      </span>
      <span class="container-icon">
        <i class="text-icon-main bi bi-bell"></i>
      </span>
      <span class="container-icon">
        <i class="text-icon-main bi bi-three-dots-vertical"></i>
      </span> -->
      <div
        class="me-5 position-relative"
        :class="{ 'indicator-circle-before': hasIndicator && user.selectedOrganization }"
      >
        <RouterLink
          class="text-bold text-small text-decoration-none"
          to="/settings/general"
          :class="networkMapping[networkStore.network]?.className || 'text-info'"
          >{{ networkMapping[networkStore.network]?.label || 'CUSTOM' }}
        </RouterLink>
      </div>
      <div>
        <UserModeSelect />
      </div>
      <span
        v-if="
          (isUserLoggedIn(user.personal) &&
            !user.personal.useKeychain &&
            !user.selectedOrganization) ||
          isLoggedInOrganization(user.selectedOrganization)
        "
        class="container-icon"
        data-testid="button-logout"
        @click="withLoader(handleLogout)"
        data-bs-toggle="tooltip"
        data-bs-trigger="hover"
        data-bs-placement="bottom"
        data-bs-custom-class="wide-tooltip"
        data-bs-title="Log out"
      >
        <i class="text-icon-main bi bi-box-arrow-up-right"></i>
      </span>
    </div>
  </div>
</template>
