<script setup lang="ts">
import { onMounted, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import {
  encrypt,
  getStaticUser,
  initializeUseKeychain,
  isKeychainAvailable,
} from '@renderer/services/safeStorageService';

import AppButton from '@renderer/components/ui/AppButton.vue';

/* Stores */
const user = useUserStore();

/* State */
const show = ref(false);

/* Handlers */
const handleUseKeychain = async () => {
  await initializeUseKeychain(true);

  await encrypt('gain_access');
  const staticUser = await getStaticUser();
  await user.login(staticUser.id, staticUser.email, true);
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
    <AppButton color="secondary" @click="handleUseKeychain">Sign in with Keychain</AppButton>
  </div>
</template>
