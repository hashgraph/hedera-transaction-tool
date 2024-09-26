<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { getUsersCount, resetDataLocal } from '@renderer/services/userService';
import {
  encrypt,
  getStaticUser,
  getUseKeychain,
  initializeUseKeychain,
  isKeychainAvailable,
} from '@renderer/services/safeStorageService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Stores */
const user = useUserStore();

/* State */
const chooseModeModalShown = ref(false);

/* Handlers */
const handleSubmit = async (e: Event) => {
  e.preventDefault();
  await handleChooseMode(true);
};

const handleChooseMode = async (useKeyChain: boolean) => {
  await resetDataLocal();
  await initializeUseKeychain(useKeyChain);

  if (useKeyChain) {
    await encrypt('gain_access');
    const staticUser = await getStaticUser();
    await user.login(staticUser.id, staticUser.email, true);
  }

  chooseModeModalShown.value = false;
};

/* Functions */
const checkShouldChoose = async () => {
  try {
    const useKeyChain = await getUseKeychain();

    if (useKeyChain) return false;

    const usersCount = await getUsersCount();
    if (usersCount === 1) return true; /* Not using keychain and has not registered */
  } catch (error) {
    /* Not initialized */
    return true;
  }

  return false;
};

async function checkShouldRegister() {
  try {
    const usersCount = await getUsersCount();
    return usersCount === 0;
  } catch (error) {
    return true;
  }
}

/* Hooks */
onMounted(async () => {
  const keychainAvailable = await isKeychainAvailable();

  if (!keychainAvailable) {
    await initializeUseKeychain(false);
    return;
  }

  const shouldChoose = await checkShouldChoose();
  chooseModeModalShown.value = shouldChoose;
});

/* Watchers */
watch(
  () => user.personal,
  async () => {
    const noUser = !user.personal || !user.personal.isLoggedIn;
    const shouldRegister = await checkShouldRegister();
    const shouldChoose = await checkShouldChoose();

    if (noUser && shouldRegister && shouldChoose) {
      chooseModeModalShown.value = shouldChoose;
    }
  },
);
</script>
<template>
  <div>
    <AppModal
      v-model:show="chooseModeModalShown"
      class="common-modal"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <i class="bi bi-x-lg cursor-pointer" @click="chooseModeModalShown = false"></i>

        <div class="text-center mt-4">
          <i class="bi bi-key large-icon"></i>
        </div>

        <form @submit="handleSubmit">
          <h3 class="text-center text-title text-bold mt-3">Keychain Usage</h3>

          <p class="text-center mt-4">
            Do you want to use the keychain to encrypt your sensitive data?
          </p>

          <hr class="separator my-5" />

          <div class="d-flex justify-content-between mt-4">
            <AppButton
              type="button"
              color="secondary"
              @click="handleChooseMode(false)"
              data-testid="button-refuse-key-chain-mode"
              >No</AppButton
            >
            <AppButton type="submit" color="primary" data-testid="button-choose-key-chain-mode">
              Yes</AppButton
            >
          </div>
        </form>
      </div>
    </AppModal>
  </div>
</template>
