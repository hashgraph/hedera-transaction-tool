<script setup lang="ts">
import { onMounted, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import useSetupStores from '@renderer/composables/user/useSetupStores';

import {
  encrypt,
  getStaticUser,
  initializeUseKeychain,
  isKeychainAvailable,
} from '@renderer/services/safeStorageService';

import AppButton from '@renderer/components/ui/AppButton.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const setupStores = useSetupStores();

/* State */
const show = ref(false);

/* Handlers */
const handleUseKeychain = async () => {
  await initializeUseKeychain(true);

  await encrypt('gain_access');
  const staticUser = await getStaticUser();
  user.setAccountSetupStarted(true);
  await user.login(staticUser.id, staticUser.email, true);
  await user.refetchOrganizations();
  await setupStores();
};

/* Hooks */
onMounted(async () => {
  const keychainAvailable = await isKeychainAvailable();

  if (keychainAvailable) {
    show.value = true;
  }
});
</script>
<template>
  <div v-if="show" class="d-grid">
    <AppButton
      color="secondary"
      data-testid="button-keychain-login"
      @click="handleUseKeychain"
    >Sign in with Keychain</AppButton>
  </div>
</template>
