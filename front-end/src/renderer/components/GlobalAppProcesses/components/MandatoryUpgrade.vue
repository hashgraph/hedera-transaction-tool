<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import useVersionCheck from '@renderer/composables/useVersionCheck';
import useElectronUpdater from '@renderer/composables/useElectronUpdater';
import useDefaultOrganization from '@renderer/composables/user/useDefaultOrganization';
import { UPDATE_ERROR_MESSAGES } from '@shared/constants';

import { errorToastOptions } from '@renderer/utils/toastOptions';

import { disconnectOrganization } from '@renderer/services/organization/disconnect';
import { logout } from '@renderer/services/organization/auth';
import { useToast } from 'vue-toast-notification';

import useUserStore from '@renderer/stores/storeUser';
import {
  triggeringOrganizationServerUrl,
  organizationCompatibilityResults,
  organizationUpdateUrls,
  getVersionStatusForOrg,
  resetVersionStatusForOrg,
  getMostRecentOrganizationRequiringUpdate,
} from '@renderer/stores/versionState';

import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import CompatibilityWarningModal from '@renderer/components/Organization/CompatibilityWarningModal.vue';
import DownloadUpgrade from '@renderer/components/GlobalAppProcesses/components/DownloadUpgrade.vue';
import InstallUpgrade from '@renderer/components/GlobalAppProcesses/components/InstallUpgrade.vue';
import CheckForUpgrade from '@renderer/components/GlobalAppProcesses/components/CheckForUpgrade.vue';
import UpgradeError from '@renderer/components/GlobalAppProcesses/components/UpgradeError.vue';

const { versionStatus, updateUrl } = useVersionCheck();
const { state, progress, error, updateInfo, startUpdate, installUpdate } = useElectronUpdater();
const user = useUserStore();
const toast = useToast();
const { setLast } = useDefaultOrganization();

const cancelLabel = 'Disconnect';

const affectedOrg = computed(() => {
  const serverUrl =
    triggeringOrganizationServerUrl.value || getMostRecentOrganizationRequiringUpdate();
  if (!serverUrl) return null;
  return user.organizations.find(org => org.serverUrl === serverUrl) || null;
});

const compatibilityResult = computed(() => {
  const serverUrl = triggeringOrganizationServerUrl.value;
  if (!serverUrl) return null;
  return organizationCompatibilityResults.value[serverUrl] || null;
});

const showCompatibilityWarning = ref(false);

const shown = computed(() => {
  if (versionStatus.value === 'belowMinimum') return true;

  return user.organizations.some(org => getVersionStatusForOrg(org.serverUrl) === 'belowMinimum');
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
        console.warn('Logout failed (may already be disconnected):', logoutError);
      }

      await user.selectOrganization(null);
      await setLast(null);

      resetVersionStatusForOrg(org.serverUrl);

      console.log(
        `[${new Date().toISOString()}] DISCONNECT Organization: ${org.nickname || org.serverUrl} (Server: ${org.serverUrl})`,
      );
      console.log(`  - Status: disconnected`);
      console.log(`  - Reason: upgradeRequired`);
      console.log(
        `  - Remaining orgs requiring update: ${user.organizations.filter(o => getVersionStatusForOrg(o.serverUrl) === 'belowMinimum').length}`,
      );
    } catch (error) {
      console.error('Failed to disconnect organization:', error);
      toast.error('Failed to disconnect organization', errorToastOptions);
    }
  }
};

const handleRetry = () => {
  const urlToUse = orgUpdateUrl.value;
  if (urlToUse) {
    startUpdate(urlToUse);
  }
};

const handleCompatibilityProceed = () => {
  showCompatibilityWarning.value = false;
  handleDownload();
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
          <span v-if="organizationsRequiringUpdate.length > 1" class="d-block mt-2 text-warning">
            <i class="bi bi-info-circle me-1"></i>
            {{ organizationsRequiringUpdate.length - 1 }}
            other organization(s) also require updates.
          </span>
        </span>
        <span v-else>
          Your current version is no longer supported.<br />
          Please update to continue using the application.
        </span>
      </p>

      <div v-if="compatibilityResult?.hasConflict" class="mt-4">
        <div class="alert alert-warning text-start" role="alert">
          <p class="text-small mb-2"><strong>Compatibility Warning:</strong></p>
          <p class="text-small mb-2">This update may cause issues with other organizations:</p>
          <ul class="list-unstyled mb-0">
            <li
              v-for="conflict in compatibilityResult.conflicts"
              :key="conflict.serverUrl"
              class="text-small"
            >
              <i class="bi bi-exclamation-circle me-2"></i>
              <strong>{{ conflict.organizationName }}</strong> - Latest supported version:
              {{ conflict.latestSupportedVersion }}
            </li>
          </ul>
        </div>
      </div>

      <hr class="separator my-4" />
      <div class="d-flex gap-4 justify-content-center">
        <AppButton type="button" color="secondary" @click="handleDisconnect">
          Disconnect
        </AppButton>
        <AppButton type="button" color="primary" @click="handleDownload">
          <i class="bi bi-download me-2"></i>Download Update
        </AppButton>
      </div>
    </div>

    <CompatibilityWarningModal
      :show="showCompatibilityWarning"
      :conflicts="compatibilityResult?.conflicts || []"
      :suggested-version="compatibilityResult?.suggestedVersion || ''"
      :is-optional="false"
      :triggering-org-name="affectedOrg?.nickname || affectedOrg?.serverUrl"
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
