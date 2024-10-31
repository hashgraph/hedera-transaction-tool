<script setup lang="ts">
import type { Network } from '@main/shared/interfaces';
import type { GLOBAL_MODAL_LOADER_TYPE } from '@renderer/providers';

import { inject, onUpdated } from 'vue';

import { CommonNetwork } from '@main/shared/enums';
import { SESSION_STORAGE_AUTH_TOKEN_PREFIX } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { logout } from '@renderer/services/organization';
import { updateOrganizationCredentials } from '@renderer/services/organizationCredentials';

import { GLOBAL_MODAL_LOADER_KEY } from '@renderer/providers';

import { isUserLoggedIn, withLoader } from '@renderer/utils';

import Logo from '@renderer/components/Logo.vue';
import LogoText from '@renderer/components/LogoText.vue';
import UserModeSelect from './UserModeSelect.vue';

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

/* Composables */
const router = useRouter();
const createTooltips = useCreateTooltips();
const toast = useToast();

/* Injected */
const globalModalLoaderRef = inject<GLOBAL_MODAL_LOADER_TYPE>(GLOBAL_MODAL_LOADER_KEY);

/* Handlers */
const handleLogout = async () => {
  if (user.selectedOrganization) {
    if (!isUserLoggedIn(user.personal)) return;

    const { id, nickname, serverUrl, key } = user.selectedOrganization;
    await logout(serverUrl);
    await updateOrganizationCredentials(id, user.personal.id, undefined, undefined, null);
    localStorage.removeItem(`${SESSION_STORAGE_AUTH_TOKEN_PREFIX}${new URL(serverUrl).origin}`);
    await user.selectOrganization(null);
    await user.selectOrganization({ id, nickname, serverUrl, key });
  } else {
    localStorage.removeItem('htx_user');
    await user.logout();
    await router.push({ name: 'login' });
  }
};

/* Hooks */
onUpdated(() => {
  createTooltips();
});
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
      <div class="me-5">
        <span
          class="text-bold text-small"
          :class="networkMapping[networkStore.network]?.className || 'text-info'"
          >{{ networkMapping[networkStore.network]?.label || 'CUSTOM' }}</span
        >
        <RouterLink class="container-icon link-white" to="/settings/general"
          ><i class="text-icon-main bi bi-toggles"></i
        ></RouterLink>
      </div>
      <div>
        <UserModeSelect />
      </div>
      <span
        v-if="
          (user.personal &&
            user.personal.isLoggedIn &&
            !user.personal.useKeychain &&
            !user.selectedOrganization) ||
          (user.selectedOrganization && !user.selectedOrganization.loginRequired)
        "
        class="container-icon"
        data-testid="button-logout"
        @click="withLoader(handleLogout, toast, globalModalLoaderRef)()"
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
