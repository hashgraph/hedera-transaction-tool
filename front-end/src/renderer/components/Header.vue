<script setup lang="ts">
import { computed, onUpdated } from 'vue';

import { networkMapping } from '@renderer/shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import Logo from '@renderer/components/Logo.vue';
import LogoText from '@renderer/components/LogoText.vue';
import NotificationsDropDown from '@renderer/components/Notifications/NotificationsDropDown.vue';
import UserModeSelect from './UserModeSelect.vue';

/* Stores */
const user = useUserStore();
const networkStore = useNetworkStore();

/* Composables */
const createTooltips = useCreateTooltips();

/* Computed */
const isAccountSetupComplete = computed(() => {
  return user.personal && user.personal.isLoggedIn && !user.accountSetupStarted ;
});

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
      v-if="isAccountSetupComplete"
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
      <div class="me-5 position-relative">
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
      <div>
        <NotificationsDropDown />
      </div>
    </div>
  </div>
</template>
