<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useSafeStorage, { SafeStorageStatus } from '@renderer/stores/storeSafeStorage.js';

import useSetupStores from '@renderer/composables/user/useSetupStores';

import { relaunch } from '@renderer/services/electronUtilsService';

import {
  getStaticUser,
  initializeUseKeychain,
  isKeychainAvailable,
} from '@renderer/services/safeStorageService';

import AppButton from '@renderer/components/ui/AppButton.vue';

/* Stores */
const user = useUserStore();
const safeStorage = useSafeStorage();

/* Composables */
const setupStores = useSetupStores();

/* State */
const show = ref(false);

/* Computed */
const safeStorageDenied = computed(() => safeStorage.status === SafeStorageStatus.denied);

/* Handlers */
const handleUseKeychain = async () => {
  if (await safeStorage.checkKeychain()) {
    // We have access to safe storage (ie keychain)
    try {
      await initializeUseKeychain(true);
    } catch {
      // Must be ignored
    }

    const staticUser = await getStaticUser();
    user.setAccountSetupStarted(true);
    await user.login(staticUser.id, staticUser.email, true);
    await user.refetchOrganizations();
    await setupStores();
  }
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
  <div v-if="show" class="d-flex flex-column align-content-center align-items-stretch">
    <AppButton
      color="secondary"
      data-testid="button-keychain-login"
      @click="handleUseKeychain"
      :disabled="safeStorageDenied"
      >Sign in with Keychain</AppButton
    >
    <template v-if="safeStorageDenied">
      <p
        class="text-micro text-secondary text-center align-self-center mt-3 mb-3"
        style="max-width: 300px"
      >
        Sign In with Keychain is disabled.<br />
        Keychain access was denied. Relaunch the application to try again.
      </p>
      <AppButton color="primary" data-testid="button-keychain-relaunch" @click="relaunch"
        >Relaunch</AppButton
      >
    </template>
  </div>
</template>
