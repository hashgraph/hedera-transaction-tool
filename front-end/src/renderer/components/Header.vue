<script setup lang="ts">
import { computed, onUpdated } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import Logo from '@renderer/components/Logo.vue';
import LogoText from '@renderer/components/LogoText.vue';
import NotificationsDropDown from '@renderer/components/Notifications/NotificationsDropDown.vue';
import UserModeSelect from './UserModeSelect.vue';
import NetworkSelect from './NetworkSelect.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const createTooltips = useCreateTooltips();

/* Computed */
const isAccountSetupComplete = computed(() => {
  return user.personal && user.personal.isLoggedIn && !user.accountSetupStarted;
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
    <div v-if="isAccountSetupComplete" class="flex-centered justify-content-end">
      <!-- <span class="container-icon">
        <i class="text-icon-main bi bi-search"></i>
      </span>
      <span class="container-icon">
        <i class="text-icon-main bi bi-bell"></i>
      </span>
      <span class="container-icon">
        <i class="text-icon-main bi bi-three-dots-vertical"></i>
      </span> -->
      <div class="me-4"><NetworkSelect /></div>
      <div>
        <UserModeSelect />
      </div>
      <div>
        <NotificationsDropDown />
      </div>
    </div>
  </div>
</template>
