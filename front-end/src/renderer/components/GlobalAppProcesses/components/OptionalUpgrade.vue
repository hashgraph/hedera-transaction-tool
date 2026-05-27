<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import useVersionCheck from '@renderer/composables/useVersionCheck';
import useElectronUpdater from '@renderer/composables/useElectronUpdater';
import { UPDATE_ERROR_MESSAGES } from '@shared/constants';

import {
  organizationCompatibilityResults,
  triggeringOrganizationServerUrl,
  initialVersionCheckState,
} from '@renderer/stores/versionState';
import useUserStore from '@renderer/stores/storeUser';

import AppModal from '@renderer/components/ui/AppModal.vue';
import CompatibilityWarningModal from '@renderer/components/Organization/CompatibilityWarningModal.vue';
import DownloadUpgrade from '@renderer/components/GlobalAppProcesses/components/DownloadUpgrade.vue';
import InstallUpgrade from '@renderer/components/GlobalAppProcesses/components/InstallUpgrade.vue';
import CheckForUpgrade from '@renderer/components/GlobalAppProcesses/components/CheckForUpgrade.vue';
import UpgradeError from '@renderer/components/GlobalAppProcesses/components/UpgradeError.vue';
import AvailableUpgrade from '@renderer/components/GlobalAppProcesses/components/AvailableUpgrade.vue';

const { versionStatus, updateUrl, latestVersion, isDismissed, dismissOptionalUpdate } =
  useVersionCheck();
const {
  state,
  progress,
  error,
  updateInfo,
  startUpdate,
  installUpdate,
  cancelUpdate
} = useElectronUpdater();
const user = useUserStore();
const route = useRoute();

const compatibilityResult = computed(() => {
  const serverUrl = triggeringOrganizationServerUrl.value;
  if (!serverUrl) return null;
  return organizationCompatibilityResults.value[serverUrl] || null;
});

const showCompatibilityWarning = ref(false);

const affectedOrg = computed(() => {
  const serverUrl = triggeringOrganizationServerUrl.value;
  if (!serverUrl) return null;
  return user.organizations.find(org => org.serverUrl === serverUrl) || null;
});

const optionalCompatibilityTitle = computed(() => 'Update Compatibility Warning');

const optionalCompatibilitySummaryText = computed(() => {
  const suggestedVersion = compatibilityResult.value?.suggestedVersion || latestVersion.value;
  const orgName = affectedOrg.value?.nickname || affectedOrg.value?.serverUrl;

  if (orgName && suggestedVersion) {
    return `The organization ${orgName} has an update available: version ${suggestedVersion}.`;
  }
  if (suggestedVersion) {
    return `An update to version ${suggestedVersion} is available.`;
  }
  return 'An update is available.';
});

const optionalCompatibilityWarningText = computed(() => {
  if (!compatibilityResult.value?.hasConflict) {
    return 'You can continue using your current version safely.';
  }
  return 'This update may affect other configured organizations. You can cancel now and continue on your current version.';
});

const shown = computed(
  () =>
    route.name !== 'migrate' &&
    initialVersionCheckState.value === 'done' &&
    versionStatus.value === 'updateAvailable' &&
    !isDismissed.value,
);

const isChecking = computed(() => state.value === 'checking');
const isDownloading = computed(() => state.value === 'downloading');
const isDownloaded = computed(() => state.value === 'downloaded');
const isInstalling = computed(() => state.value === 'installing');
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

const handleCancel = () => {
  cancelUpdate();
  dismissOptionalUpdate();
};

const handleRetry = () => {
  if (updateUrl.value) {
    startUpdate(updateUrl.value);
  }
};

watch(
  [shown, compatibilityResult],
  ([isShown, compatResult]) => {
    showCompatibilityWarning.value =
      isShown && compatResult?.hasConflict === true;
  },
  { immediate: true },
);
</script>
<template>
  <AppModal
    :show="shown"
    :close-on-click-outside="false"
    class="modal-fit-content"
    :loading="isInstalling"
  >
    <CheckForUpgrade
      v-if="isChecking"
    />

    <DownloadUpgrade
      v-else-if="isDownloading"
      :version="updateInfo?.version"
      :progress="progress"
      :progress-label="progressBarLabel"
      @cancel="handleCancel"
    />

    <InstallUpgrade
      v-else-if="isDownloaded || isInstalling"
      :version="updateInfo?.version"
      :is-installing="isInstalling"
      @cancel="handleCancel"
      @install="handleInstall"
    />

    <UpgradeError
      v-else-if="hasError && errorMessage"
      :error-message="errorMessage"
      @cancel="handleCancel"
      @retry="handleRetry"
    />

    <AvailableUpgrade
      v-else
      :latest-version="latestVersion"
      @cancel="handleCancel"
      @update="handleUpdate"
    />

    <CompatibilityWarningModal
      v-if="compatibilityResult"
      v-model:show="showCompatibilityWarning"
      :title="optionalCompatibilityTitle"
      :summary-text="optionalCompatibilitySummaryText"
      :warning-text="optionalCompatibilityWarningText"
      :conflicts="compatibilityResult.conflicts || []"
      :conflicts-title="'Conflicting Organizations'"
      :cancel-label="'Not Now'"
      :proceed-label="'Proceed with Update'"
      @proceed="handleUpdate"
      @cancel="handleCancel"
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
