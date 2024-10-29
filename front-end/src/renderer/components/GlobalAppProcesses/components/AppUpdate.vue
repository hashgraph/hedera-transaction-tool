<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref } from 'vue';

import { openPath } from '@renderer/services/electronUtilsService';

import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* State */
const location = ref<string | null>(null);
const isUpdateAvailableShown = ref(false);

/* Computed */
const version = computed(() => {
  return '1.0.0';
});

/* Handlers */
const handleCheckingForUpdatesResult = (_location: string | null) => {
  location.value = _location;

  if (_location) {
    isUpdateAvailableShown.value = true;
  }
};

const handleOpenUpdateLocation = () => {
  if (location.value) {
    openPath(location.value);
    isUpdateAvailableShown.value = false;
  }
};

/* Hooks */
onBeforeMount(() => {
  window.electronAPI.local.update.onceCheckingForUpdateResult(handleCheckingForUpdatesResult);
});

onMounted(() => {
  window.electronAPI.local.update.checkForUpdate();
});
</script>
<template>
  <!-- Update Available -->
  <AppModal
    :show="isUpdateAvailableShown"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="common-modal"
  >
    <div class="text-center p-4">
      <div>
        <img src="/images/icon.png" style="height: 10vh" />
      </div>
      <h2 class="text-title text-semi-bold mt-5">Update Available at</h2>
      <p class="text-small text-secondary mt-3">{{ location || '' }}</p>
      <p class="text-small text-secondary mt-3">Version {{ version || '' }}</p>

      <hr class="separator my-5" />

      <AppButton type="button" color="primary" @click="handleOpenUpdateLocation">Open</AppButton>
    </div>
  </AppModal>
</template>
