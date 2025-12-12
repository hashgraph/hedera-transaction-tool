<script setup lang="ts">
import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import { computed, onBeforeMount, ref } from 'vue';
import { useToast } from 'vue-toast-notification';

import { convertBytes } from '@renderer/utils';

import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppProgressBar from '@renderer/components/ui/AppProgressBar.vue';

/* Composables */
const toast = useToast();

/* State */
const updateInfo = ref<UpdateInfo | null>(null);
const progressInfo = ref<ProgressInfo | null>(null);
const isCheckingForUpdateShown = ref(false);
const isUpdateAvailableShown = ref(false);
const isUpdateNotAvailableShown = ref(false);
const isDownloadingUpdateShown = ref(false);
const isDownloadedShown = ref(false);

/* Computed */
const progressBarLabel = computed(() => {
  if (progressInfo.value && progressInfo.value.percent > 20) {
    return `${progressInfo.value?.percent.toFixed(2)}%`;
  } else {
    return '';
  }
});

/* Handlers */
const handleCheckingForUpdates = () => {
  isCheckingForUpdateShown.value = true;
};

const handleUpdateAvailable = (info: UpdateInfo) => {
  updateInfo.value = info;
  isCheckingForUpdateShown.value = false;
  isUpdateAvailableShown.value = true;
};

const handleUpdateNotAvailable = () => {
  isCheckingForUpdateShown.value = false;
  isUpdateNotAvailableShown.value = true;
  updateInfo.value = null;
};

const handleDownloadUpdate = () => {
  window.electronAPI.local.update.downloadUpdate();
  isUpdateAvailableShown.value = false;
  isDownloadingUpdateShown.value = true;
};

const handleDownloadProgress = (info: ProgressInfo) => {
  progressInfo.value = info;
};

const handleUpdateDownloaded = () => {
  isDownloadingUpdateShown.value = false;
  isDownloadedShown.value = true;
};

const handleInstall = () => {
  window.electronAPI.local.update.quitAndInstall();
};

const handlerError = (error: { message: string; cause?: any; stack?: string }) => {
  /* Reset all modals */
  isCheckingForUpdateShown.value = false;
  isUpdateAvailableShown.value = false;
  isUpdateNotAvailableShown.value = false;
  isDownloadingUpdateShown.value = false;
  isDownloadedShown.value = false;

  /* Show error toast */
  toast.error(error.message, { position: 'bottom-right' });
};

/* Hooks */
onBeforeMount(() => {
  window.electronAPI.local.update.onCheckingForUpdate(handleCheckingForUpdates);
  window.electronAPI.local.update.onError(handlerError);
  window.electronAPI.local.update.onUpdateAvailable(handleUpdateAvailable);
  window.electronAPI.local.update.onUpdateNotAvailable(handleUpdateNotAvailable);
  window.electronAPI.local.update.onDownloadProgress(handleDownloadProgress);
  window.electronAPI.local.update.onUpdateDownloaded(handleUpdateDownloaded);
});
</script>
<template>
  <!-- Checking for update -->
  <AppModal
    :show="isCheckingForUpdateShown"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="modal-fit-content"
  >
    <div class="text-center px-9 py-5">
      <div>
        <img src="/images/icon.png" class="pulse" style="height: 10vh" />
      </div>
      <p class="mt-5">Checking for update</p>
    </div>
  </AppModal>
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
      <h2 class="text-title text-semi-bold mt-5">Update Available</h2>
      <p class="text-small text-secondary mt-3">Version {{ updateInfo?.version || '' }}</p>

      <hr class="separator my-5" />

      <div class="flex-between-centered gap-4">
        <AppButton color="borderless" @click="isUpdateAvailableShown = false">Cancel</AppButton>
        <AppButton color="primary" @click="handleDownloadUpdate">Download</AppButton>
      </div>
    </div>
  </AppModal>
  <!-- Update Not Available -->
  <AppModal :show="isUpdateNotAvailableShown" class="common-modal">
    <div class="text-center p-4">
      <div>
        <img src="/images/icon.png" style="height: 10vh" />
      </div>
      <h2 class="text-title text-semi-bold mt-5">Update Not Available</h2>
      <div class="d-grid mt-5">
        <AppButton color="secondary" class="mt-3" @click="isUpdateNotAvailableShown = false">
          Close
        </AppButton>
      </div>
    </div>
  </AppModal>
  <!-- Downloading -->
  <AppModal
    :show="isDownloadingUpdateShown"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="common-modal"
  >
    <div class="text-center p-4">
      <div>
        <img src="/images/icon.png" style="height: 10vh" />
      </div>
      <h2 class="text-title text-semi-bold mt-5">Downloading update</h2>
      <p class="text-small text-secondary mt-3">Version {{ updateInfo?.version || '' }}</p>
      <div class="d-grid mt-4">
        <div class="d-flex justify-content-between">
          <p class="text-start text-footnote mt-3" v-if="progressInfo">
            {{
              convertBytes(progressInfo?.transferred || 0, {
                useBinaryUnits: false,
                decimals: 2,
              }) || '0'
            }}
            of
            {{
              convertBytes(progressInfo?.total || 0, { useBinaryUnits: false, decimals: 2 }) || '0'
            }}
          </p>
          <p class="text-start text-micro mt-3" v-if="progressInfo">
            {{
              convertBytes(progressInfo?.bytesPerSecond || 0, {
                useBinaryUnits: false,
                decimals: 2,
              }) || ''
            }}/s
          </p>
        </div>

        <AppProgressBar
          :percent="Number(progressInfo?.percent.toFixed(2)) || 0"
          :label="progressBarLabel"
          :height="18"
          class="mt-2"
        />
      </div>
    </div>
  </AppModal>
  <!-- Install Update -->
  <AppModal
    :show="isDownloadedShown"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="common-modal"
  >
    <div class="text-center p-4">
      <div>
        <img src="/images/icon.png" style="height: 10vh" />
      </div>
      <h2 class="text-title text-semi-bold mt-5">Install Update</h2>
      <p class="text-small text-secondary mt-3">Version {{ updateInfo?.version || '' }}</p>
      <div class="d-grid mt-5">
        <AppButton color="primary" @click="handleInstall">Install</AppButton>
      </div>
    </div>
  </AppModal>
</template>
