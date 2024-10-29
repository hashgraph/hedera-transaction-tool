<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';

import { UPDATE_LOCATION } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { openPath } from '@renderer/services/electronUtilsService';
import { getStoredClaim } from '@renderer/services/claimService';

import { isUserLoggedIn } from '@renderer/utils';

import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Stores */
const user = useUserStore();

/* State */
const isUpdateAvailableShown = ref(false);

/* Computed */
const location = ref<string>('');
const version = ref<string | null>(null);

/* Handlers */
const handleCheckingForUpdatesResult = (newVersion: string | null) => {
  version.value = newVersion;

  if (newVersion) {
    isUpdateAvailableShown.value = true;
  }
};

const handleOpenUpdateLocation = () => {
  isUpdateAvailableShown.value = false;
  if (location.value) {
    openPath(location.value);
  }
};

/* Hooks */
onBeforeMount(() => {
  window.electronAPI.local.update.onceCheckingForUpdateResult(handleCheckingForUpdatesResult);
});

watch(
  () => user.personal,
  async newUser => {
    if (isUserLoggedIn(newUser)) {
      location.value = (await getStoredClaim(newUser.id, UPDATE_LOCATION)) || '';
      window.electronAPI.local.update.checkForUpdate(location.value);
    }
  },
);
</script>
<template>
  <!-- Update Available -->
  <AppModal
    :show="isUpdateAvailableShown"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="modal-fit-content"
  >
    <div class="text-center p-4">
      <div>
        <img src="/images/icon.png" style="height: 10vh" />
      </div>
      <h2 class="text-title text-semi-bold mt-5">Update Available</h2>
      <p class="text-small text-secondary mt-3">Version {{ version || '' }}</p>
      <p class="text-small text-secondary mt-3">{{ location || '' }}</p>

      <hr class="separator my-5" />

      <AppButton type="button" color="primary" @click="handleOpenUpdateLocation">Open</AppButton>
    </div>
  </AppModal>
</template>
