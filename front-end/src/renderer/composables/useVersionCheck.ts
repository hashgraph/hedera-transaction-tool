import { ref } from 'vue';

import { SESSION_STORAGE_DISMISSED_UPDATE_PROMPT } from '@shared/constants';

import { checkVersion } from '@renderer/services/organization';
import { FRONTEND_VERSION } from '@renderer/utils/version';

import {
  versionStatus,
  updateUrl,
  latestVersion,
  resetVersionState,
  type VersionStatus,
} from '@renderer/stores/versionState';

const isChecking = ref(false);
const isDismissed = ref(sessionStorage.getItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT) === 'true');

export default function useVersionCheck() {
  const performVersionCheck = async (serverUrl: string): Promise<void> => {
    if (isChecking.value) return;

    try {
      isChecking.value = true;

      const response = await checkVersion(serverUrl, FRONTEND_VERSION);

      updateUrl.value = response.updateUrl;
      latestVersion.value = response.latestSupportedVersion;

      versionStatus.value = response.updateUrl ? 'updateAvailable' : 'current';
    } catch (error) {
      console.error('Version check failed:', error);
      if (versionStatus.value !== 'belowMinimum') {
        versionStatus.value = 'current';
      }
    } finally {
      isChecking.value = false;
    }
  };

  const dismissOptionalUpdate = (): void => {
    sessionStorage.setItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT, 'true');
    isDismissed.value = true;
  };

  const reset = (): void => {
    resetVersionState();
    isChecking.value = false;
    isDismissed.value = false;
    sessionStorage.removeItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT);
  };

  return {
    versionStatus,
    updateUrl,
    latestVersion,
    isChecking,
    performVersionCheck,
    isDismissed,
    dismissOptionalUpdate,
    reset,
  };
}

export type { VersionStatus };
