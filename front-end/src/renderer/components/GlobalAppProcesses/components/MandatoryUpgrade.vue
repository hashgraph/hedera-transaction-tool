<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import useVersionCheck from '@renderer/composables/useVersionCheck';
import useElectronUpdater from '@renderer/composables/useElectronUpdater';
import { UPDATE_ERROR_MESSAGES } from '@shared/constants';

import { quit } from '@renderer/services/electronUtilsService';
import { disconnectOrganization } from '@renderer/services/organization/disconnect';
import { logout } from '@renderer/services/organization/auth';
import { convertBytes } from '@renderer/utils';
import { useToast } from 'vue-toast-notification';

import useUserStore from '@renderer/stores/storeUser';
import useDefaultOrganization from '@renderer/composables/user/useDefaultOrganization';
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
import AppProgressBar from '@renderer/components/ui/AppProgressBar.vue';
import CompatibilityWarningModal from '@renderer/components/Organization/CompatibilityWarningModal.vue';
import { errorToastOptions } from '@renderer/utils/toastOptions';

const { versionStatus, updateUrl } = useVersionCheck();
const { state, progress, error, updateInfo, startUpdate, installUpdate } = useElectronUpdater();
const user = useUserStore();
const toast = useToast();
const { setLast } = useDefaultOrganization();

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
      // Disconnect organization (websocket, connection status, auth token)
      await disconnectOrganization(org.serverUrl, 'upgradeRequired');

      // Logout from organization
      try {
        await logout(org.serverUrl);
      } catch (logoutError) {
        // Log but don't fail - organization might already be disconnected
        console.warn('Logout failed (may already be disconnected):', logoutError);
      }

      // Switch to personal mode or another connected organization
      await user.selectOrganization(null);
      await setLast(null);

      // Reset version status for this org (will auto-select next org if multiple require updates)
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
  >
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
        <AppButton type="button" color="secondary" @click="handleDisconnect">
          Disconnect
        </AppButton>
        <AppButton type="button" color="primary" @click="handleRetry">
          <i class="bi bi-arrow-repeat me-2"></i>Try Again
        </AppButton>
      </div>
    </div>

    <!-- Initial prompt -->
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
          <span
            v-if="
              user.organizations.filter(
                org => getVersionStatusForOrg(org.serverUrl) === 'belowMinimum',
              ).length > 1
            "
            class="d-block mt-2 text-warning"
          >
            <i class="bi bi-info-circle me-1"></i>
            {{
              user.organizations.filter(
                org => getVersionStatusForOrg(org.serverUrl) === 'belowMinimum',
              ).length - 1
            }}
            other organization(s) also require updates.
          </span>
        </span>
        <span v-else>
          Your current version is no longer supported.<br />
          Please update to continue using the application.
        </span>
      </p>

      <!-- Compatibility warning section -->
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
          {{ affectedOrg ? 'Disconnect' : 'Quit' }}
        </AppButton>
        <AppButton type="button" color="primary" @click="handleDownload">
          <i class="bi bi-download me-2"></i>Download Update
        </AppButton>
      </div>
    </div>

    <!-- Compatibility Warning Modal -->
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

.alert {
  padding: 1rem;
  border-radius: 0.375rem;
}

.alert-warning {
  background-color: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  color: #856404;
}

.list-unstyled {
  padding-left: 0;
  list-style: none;
}
</style>
