<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import useVersionCheck from '@renderer/composables/useVersionCheck';
import useElectronUpdater from '@renderer/composables/useElectronUpdater';
import { UPDATE_ERROR_MESSAGES } from '@shared/constants';

import { convertBytes } from '@renderer/utils';
import { checkCompatibilityAcrossOrganizations } from '@renderer/services/organization/versionCompatibility';
import { getAllOrganizationVersions } from '@renderer/stores/versionState';

import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppProgressBar from '@renderer/components/ui/AppProgressBar.vue';
import CompatibilityWarningModal from '@renderer/components/Organization/CompatibilityWarningModal.vue';

const { versionStatus, updateUrl, latestVersion, isDismissed, dismissOptionalUpdate } =
  useVersionCheck();
const { state, progress, error, updateInfo, startUpdate, installUpdate, cancelUpdate } =
  useElectronUpdater();

const compatibilityResult = ref<{
  hasConflict: boolean;
  conflicts: any[];
  suggestedVersion: string | null;
  isOptional: boolean;
} | null>(null);
const showCompatibilityWarning = ref(false);
const isCheckingCompatibility = ref(false);

watch([() => versionStatus.value, () => latestVersion.value], async ([status, latestVer]) => {
  if (status === 'updateAvailable' && latestVer && !isDismissed.value) {
    isCheckingCompatibility.value = true;
    try {
      const allVersions = getAllOrganizationVersions();
      const orgsWithUpdates = Object.entries(allVersions).filter(([, data]) => data?.updateUrl);

      for (const [serverUrl, versionData] of orgsWithUpdates) {
        if (versionData?.latestSupportedVersion) {
          const result = await checkCompatibilityAcrossOrganizations(
            versionData.latestSupportedVersion,
            serverUrl,
          );
          if (result.hasConflict) {
            compatibilityResult.value = result;
            showCompatibilityWarning.value = true;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Compatibility check failed:', error);
    } finally {
      isCheckingCompatibility.value = false;
    }
  }
});

const shown = computed(
  () =>
    versionStatus.value === 'updateAvailable' &&
    !isDismissed.value &&
    !showCompatibilityWarning.value,
);

const isChecking = computed(() => state.value === 'checking');
const isDownloading = computed(() => state.value === 'downloading');
const isDownloaded = computed(() => state.value === 'downloaded');
const hasError = computed(() => state.value === 'error');

const errorMessage = computed(() => {
  if (!error.value) return null;
  return UPDATE_ERROR_MESSAGES[error.value.type];
});

const progressBarLabel = computed(() => {
  if (progress.value && progress.value.percent > 20) {
    return `${progress.value.percent.toFixed(2)}%`;
  }
  return '';
});

const handleUpdate = () => {
  if (updateUrl.value) {
    startUpdate(updateUrl.value);
  }
};

const handleInstall = () => {
  installUpdate();
};

const handleLater = () => {
  cancelUpdate();
  dismissOptionalUpdate();
  showCompatibilityWarning.value = false;
  compatibilityResult.value = null;
};

const handleRetry = () => {
  if (updateUrl.value) {
    startUpdate(updateUrl.value);
  }
};

const handleCompatibilityProceed = () => {
  showCompatibilityWarning.value = false;
  handleUpdate();
};

const handleCompatibilityCancel = () => {
  showCompatibilityWarning.value = false;
  handleLater();
};
</script>
<template>
  <AppModal :show="shown" :close-on-click-outside="false" class="modal-fit-content">
    <!-- Checking for update -->
    <div v-if="isChecking" class="text-center p-4">
      <div>
        <i
          class="bi bi-arrow-repeat text-primary"
          style="font-size: 4rem; animation: spin 1s linear infinite"
        ></i>
      </div>
      <h2 class="text-title text-semi-bold mt-4">Checking for Update</h2>
      <p class="text-small text-secondary mt-3">Please wait...</p>
    </div>

    <!-- Downloading -->
    <div v-else-if="isDownloading" class="text-center p-4">
      <div>
        <i class="bi bi-download text-primary" style="font-size: 4rem"></i>
      </div>
      <h2 class="text-title text-semi-bold mt-4">Downloading Update</h2>
      <p class="text-small text-secondary mt-3" v-if="updateInfo">
        Version {{ updateInfo.version }}
      </p>
      <div class="d-grid mt-4" v-if="progress">
        <div class="d-flex justify-content-between">
          <p class="text-start text-footnote mt-3">
            {{
              convertBytes(progress.transferred || 0, { useBinaryUnits: false, decimals: 2 }) || '0'
            }}
            of
            {{ convertBytes(progress.total || 0, { useBinaryUnits: false, decimals: 2 }) || '0' }}
          </p>
          <p class="text-start text-micro mt-3">
            {{
              convertBytes(progress.bytesPerSecond || 0, { useBinaryUnits: false, decimals: 2 }) ||
              ''
            }}/s
          </p>
        </div>
        <AppProgressBar
          :percent="Number(progress.percent?.toFixed(2)) || 0"
          :label="progressBarLabel"
          :height="18"
          class="mt-2"
        />
      </div>
      <hr class="separator my-4" />
      <div class="d-flex gap-4 justify-content-center">
        <AppButton type="button" color="secondary" @click="handleLater">Cancel</AppButton>
      </div>
    </div>

    <!-- Downloaded -->
    <div v-else-if="isDownloaded" class="text-center p-4">
      <div>
        <i class="bi bi-check-circle-fill text-success" style="font-size: 4rem"></i>
      </div>
      <h2 class="text-title text-semi-bold mt-4">Update Ready to Install</h2>
      <p class="text-small text-secondary mt-3" v-if="updateInfo">
        Version {{ updateInfo.version }} has been downloaded.<br />
        The application will restart to install the update.
      </p>
      <hr class="separator my-4" />
      <div class="d-flex gap-4 justify-content-center">
        <AppButton type="button" color="secondary" @click="handleLater">Later</AppButton>
        <AppButton type="button" color="primary" @click="handleInstall">
          <i class="bi bi-arrow-clockwise me-2"></i>Install & Restart
        </AppButton>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="hasError && errorMessage" class="text-center p-4">
      <div>
        <i class="bi bi-exclamation-triangle-fill text-danger" style="font-size: 4rem"></i>
      </div>
      <h2 class="text-title text-semi-bold mt-4">{{ errorMessage.title }}</h2>
      <p class="text-small text-secondary mt-3">
        {{ errorMessage.message }}<br />
        {{ errorMessage.action }}
      </p>
      <hr class="separator my-4" />
      <div class="d-flex gap-4 justify-content-center">
        <AppButton type="button" color="secondary" @click="handleLater">Later</AppButton>
        <AppButton type="button" color="primary" @click="handleRetry">
          <i class="bi bi-arrow-repeat me-2"></i>Try Again
        </AppButton>
      </div>
    </div>

    <!-- Initial prompt -->
    <div v-else class="text-center p-4">
      <div>
        <i class="bi bi-arrow-up-circle-fill text-primary" style="font-size: 4rem"></i>
      </div>
      <h2 class="text-title text-semi-bold mt-4">Update Available</h2>
      <p class="text-small text-secondary mt-3">
        A new version <span v-if="latestVersion" class="text-bold">({{ latestVersion }})</span> is
        available.<br />
        Would you like to update now?
      </p>
      <hr class="separator my-4" />
      <div class="d-flex gap-4 justify-content-center">
        <AppButton type="button" color="secondary" @click="handleLater">Later</AppButton>
        <AppButton type="button" color="primary" @click="handleUpdate">
          <i class="bi bi-download me-2"></i>Update Now
        </AppButton>
      </div>
    </div>

    <!-- Compatibility Warning Modal -->
    <CompatibilityWarningModal
      v-if="compatibilityResult"
      :show="showCompatibilityWarning"
      :conflicts="compatibilityResult.conflicts || []"
      :suggested-version="compatibilityResult.suggestedVersion || latestVersion || ''"
      :is-optional="true"
      @proceed="handleCompatibilityProceed"
      @cancel="handleCompatibilityCancel"
      @update:show="showCompatibilityWarning = $event"
    />
  </AppModal>
</template>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
