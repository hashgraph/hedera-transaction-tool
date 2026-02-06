<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import useVersionCheck from '@renderer/composables/useVersionCheck';
import useElectronUpdater from '@renderer/composables/useElectronUpdater';
import { UPDATE_ERROR_MESSAGES } from '@shared/constants';

import { checkCompatibilityAcrossOrganizations } from '@renderer/services/organization/versionCompatibility';
import type { CompatibilityConflict } from '@renderer/services/organization/versionCompatibility';

import {
  getAllOrganizationVersions,
  getVersionStatusForOrg,
  triggeringOrganizationServerUrl,
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

const compatibilityResult = ref<{
  hasConflict: boolean;
  conflicts: CompatibilityConflict[];
  suggestedVersion: string | null;
  isOptional: boolean;
} | null>(null);
const showCompatibilityWarning = ref(false);
const isCheckingCompatibility = ref(false);

const affectedOrg = computed(() => {
  const serverUrl =
    triggeringOrganizationServerUrl.value;
  if (!serverUrl) return null;
  return user.organizations.find(org => org.serverUrl === serverUrl) || null;
});

const shown = computed(
  () =>
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

const runCompatibilityCheck = async () => {
  if (
    versionStatus.value !== 'updateAvailable' ||
    !latestVersion.value ||
    isDismissed.value ||
    isCheckingCompatibility.value
  ) {
    return;
  }

  isCheckingCompatibility.value = true;

  try {
    const orgsWithOptionalUpdates = user.organizations.filter(
      org => getVersionStatusForOrg(org.serverUrl) === 'updateAvailable',
    );

    if (orgsWithOptionalUpdates.length === 0) {
      return;
    }

    const triggeringOrg = orgsWithOptionalUpdates[0];
    const allVersions = getAllOrganizationVersions();
    const versionData = allVersions[triggeringOrg.serverUrl];

    if (versionData?.latestSupportedVersion) {
      const result = await checkCompatibilityAcrossOrganizations(
        versionData.latestSupportedVersion,
        triggeringOrg.serverUrl,
      );

      if (result.hasConflict) {
        compatibilityResult.value = result;
        showCompatibilityWarning.value = true;
      }
    }
  } catch (error) {
    console.error('Compatibility check failed:', error);
  } finally {
    isCheckingCompatibility.value = false;
  }
};

watch(
  () => shown.value,
  newVal => {
    compatibilityResult.value = null;
    showCompatibilityWarning.value = false;
    if (newVal) {
      void runCompatibilityCheck();
    }
  },
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
      :conflicts="compatibilityResult.conflicts || []"
      :suggested-version="compatibilityResult.suggestedVersion || latestVersion || ''"
      :is-optional="true"
      :triggering-org-name="affectedOrg ? affectedOrg.nickname || affectedOrg.serverUrl : ''"
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
