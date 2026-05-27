<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { createLogger } from '@renderer/utils/logger';

const logger = createLogger('renderer.mandatoryUpgrade');

import useVersionCheck from '@renderer/composables/useVersionCheck';
import useElectronUpdater from '@renderer/composables/useElectronUpdater';
import useDefaultOrganization from '@renderer/composables/user/useDefaultOrganization';
import { UPDATE_ERROR_MESSAGES } from '@shared/constants';

import { disconnectOrganization } from '@renderer/services/organization/disconnect';
import { logout } from '@renderer/services/organization/auth';
import { ToastManager } from '@renderer/utils/ToastManager';

import useUserStore from '@renderer/stores/storeUser';
import {
  triggeringOrganizationServerUrl,
  organizationCompatibilityResults,
  organizationUpdateUrls,
  getVersionStatusForOrg,
  resetVersionStatusForOrg,
  getMostRecentOrganizationRequiringUpdate,
  initialVersionCheckState,
} from '@renderer/stores/versionState';

import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import CompatibilityWarningModal from '@renderer/components/Organization/CompatibilityWarningModal.vue';
import DownloadUpgrade from '@renderer/components/GlobalAppProcesses/components/DownloadUpgrade.vue';
import InstallUpgrade from '@renderer/components/GlobalAppProcesses/components/InstallUpgrade.vue';
import CheckForUpgrade from '@renderer/components/GlobalAppProcesses/components/CheckForUpgrade.vue';
import UpgradeError from '@renderer/components/GlobalAppProcesses/components/UpgradeError.vue';

const { versionStatus, updateUrl } = useVersionCheck();
const { state, progress, error, updateInfo, startUpdate, installUpdate, cancelUpdate } = useElectronUpdater();
const user = useUserStore();
const toastManager = ToastManager.inject();
const { setLast } = useDefaultOrganization();

const affectedOrg = computed(() => {
  const serverUrl =
    triggeringOrganizationServerUrl.value || getMostRecentOrganizationRequiringUpdate();
  if (!serverUrl) return null;
  return user.organizations.find(org => org.serverUrl === serverUrl) || null;
});

// 'Disconnect' when an org is in the store; 'Cancel' during migration before the org is
// saved to DB (affectedOrg is null because it hasn't been added yet).
const cancelLabel = computed(() => (affectedOrg.value ? 'Disconnect' : 'Cancel'));

const compatibilityResult = computed(() => {
  const serverUrl = triggeringOrganizationServerUrl.value;
  if (!serverUrl) return null;
  return organizationCompatibilityResults.value[serverUrl] || null;
});

const showCompatibilityWarning = ref(false);

const shown = computed(() => {
  if (initialVersionCheckState.value !== 'done') return false;
  return versionStatus.value === 'belowMinimum';
});

const orgUpdateUrl = computed(() => {
  const serverUrl = triggeringOrganizationServerUrl.value;
  if (serverUrl && organizationUpdateUrls.value[serverUrl]) {
    return organizationUpdateUrls.value[serverUrl];
  }
  return updateUrl.value;
});

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

const organizationsRequiringUpdate = computed(() => {
  return user.organizations.filter(org => getVersionStatusForOrg(org.serverUrl) === 'belowMinimum');
});

const compatibilityDisconnectMessage = computed(() => {
  const conflictCount = compatibilityResult.value?.conflicts.length ?? 0;
  if (conflictCount === 0) return '';

  const backendLabel = conflictCount === 1 ? 'backend' : 'backends';
  return `If you proceed, all incompatible ${backendLabel} listed below will be disconnected before the update download starts. If you cancel, only this triggering backend will be disconnected.`;
});

const mandatoryUpdateMessage = computed(() => {
  const count = organizationsRequiringUpdate.value.length;
  if (organizationsRequiringUpdate.value.length > 1) {
    return `${count} backends currently require this mandatory upgrade. If you continue without updating, all of them will need to be disconnected.`;
  }

  return 'This backend requires a mandatory upgrade to continue.';
});

const mandatoryCompatibilityTitle = computed(() => 'Update Required - Compatibility Warning');

const mandatoryCompatibilitySummaryText = computed(() => {
  const orgName = affectedOrg.value?.nickname || affectedOrg.value?.serverUrl;
  const suggestedVersion = compatibilityResult.value?.suggestedVersion;

  if (orgName && suggestedVersion) {
    return `The organization ${orgName} requires an update to version ${suggestedVersion}.`;
  }
  if (orgName) {
    return `The organization ${orgName} requires an update.`;
  }
  if (suggestedVersion) {
    return `An update to version ${suggestedVersion} is required.`;
  }
  return 'An update is required.';
});

const mandatoryCompatibilityProceedLabel = computed(
  () => 'Disconnect Incompatible Backends and Continue',
);

const mandatoryCompatibilityCancelLabel = computed(() => 'Disconnect This Backend');

watch(
  [shown, compatibilityResult],
  ([isShown, compatResult]) => {
    if (isShown && compatResult?.hasConflict) {
      showCompatibilityWarning.value = true;
    }
  },
  { immediate: true },
);

const handleDownload = () => {
  const urlToUse = orgUpdateUrl.value;
  if (urlToUse) {
    startUpdate(urlToUse);
  }
};

const handleInstall = () => {
  installUpdate();
};

const handleDisconnect = async () => {
  const org = affectedOrg.value;
  if (org) {
    try {
      await disconnectOrganization(org.serverUrl, 'upgradeRequired');

      try {
        await logout(org.serverUrl);
      } catch (logoutError) {
        logger.warn('Logout failed (may already be disconnected)', { error: logoutError });
      }

      await user.selectOrganization(null);
      await setLast(null);

      resetVersionStatusForOrg(org.serverUrl);

      logger.info('Disconnected organization due to upgrade requirement', {
        organization: org.nickname || org.serverUrl,
        serverUrl: org.serverUrl,
        reason: 'upgradeRequired',
        remainingOrgsRequiringUpdate: user.organizations.filter(o => getVersionStatusForOrg(o.serverUrl) === 'belowMinimum').length,
      });
    } catch (error) {
      logger.error('Failed to disconnect organization', { error });
      toastManager.error('Failed to disconnect organization');
    }
  } else {
    // No org in the store yet (e.g. during migration before the org is saved to DB).
    // Cancel any in-progress download, then clear version state so the modal closes.
    // The migration form will show its own error explaining that an upgrade is required.
    cancelUpdate();
    const serverUrl = triggeringOrganizationServerUrl.value;
    if (serverUrl) {
      resetVersionStatusForOrg(serverUrl);
    }
  }
};

const handleRetry = () => {
  const urlToUse = orgUpdateUrl.value;
  if (urlToUse) {
    startUpdate(urlToUse);
  }
};

const handleCompatibilityProceed = async () => {
  showCompatibilityWarning.value = false;
  const conflictTargets = compatibilityResult.value?.conflicts ?? [];

  try {
    await Promise.all(
      conflictTargets.map(conflict =>
        disconnectOrganization(conflict.serverUrl, 'compatibilityConflict'),
      ),
    );
    handleDownload();
  } catch (error) {
      logger.error('Failed to disconnect incompatible backends before update', { error });
      toastManager.error('Failed to disconnect incompatible backends');
  }
};

const handleCompatibilityCancel = () => {
  showCompatibilityWarning.value = false;
  handleDisconnect();
};
</script>
<template>
  <AppModal
    :show="shown"
    :close-on-click-outside="false"
    :close-on-escape="false"
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
      :cancel-label="cancelLabel"
      @cancel="handleDisconnect"
    />

    <InstallUpgrade
      v-else-if="isDownloaded || isInstalling"
      :version="updateInfo?.version"
      :is-installing="isInstalling"
      :cancel-label="cancelLabel"
      @cancel="handleDisconnect"
      @install="handleInstall"
    />

    <UpgradeError
      v-else-if="hasError && errorMessage"
      :error-message="errorMessage"
      :cancel-label="cancelLabel"
      @cancel="handleDisconnect"
      @retry="handleRetry"
    />

    <div v-else class="text-center p-4">
      <div>
        <i class="bi bi-exclamation-triangle-fill text-warning" style="font-size: 4rem"></i>
      </div>
      <h2 class="text-title text-semi-bold mt-4">Update Required</h2>
      <p class="text-small text-secondary mt-3">
        <span v-if="affectedOrg">
          The organization
          <strong>{{ affectedOrg.nickname || affectedOrg.serverUrl }}</strong> requires an update to
          continue.<br />
          Your current version is no longer supported by this organization.
          <span class="d-block mt-2 text-warning">
            <i class="bi bi-info-circle me-1"></i>
            {{ mandatoryUpdateMessage }}
          </span>
        </span>
        <span v-else>
          Your current version is no longer supported.<br />
          Please update to continue using the application.
        </span>
      </p>

      <hr class="separator my-4" />
      <div class="d-flex gap-4 justify-content-center">
        <AppButton type="button" color="secondary" @click="handleDisconnect">
          {{ cancelLabel }}
        </AppButton>
        <AppButton type="button" color="primary" @click="handleDownload">
          <i class="bi bi-download me-2"></i>Download Update
        </AppButton>
      </div>
    </div>

    <CompatibilityWarningModal
      :show="showCompatibilityWarning"
      :title="mandatoryCompatibilityTitle"
      :summary-text="mandatoryCompatibilitySummaryText"
      :warning-text="compatibilityDisconnectMessage"
      :conflicts="compatibilityResult?.conflicts || []"
      :conflicts-title="'Incompatible Organizations'"
      :cancel-label="mandatoryCompatibilityCancelLabel"
      :proceed-label="mandatoryCompatibilityProceedLabel"
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
