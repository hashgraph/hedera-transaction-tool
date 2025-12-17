import { ref } from 'vue';

import { SESSION_STORAGE_DISMISSED_UPDATE_PROMPT } from '@shared/constants';

import { checkVersion } from '@renderer/services/organization';

export type VersionStatus = 'current' | 'updateAvailable' | 'belowMinimum' | null;

const versionStatus = ref<VersionStatus>(null);
const updateUrl = ref<string | null>(null);
const latestVersion = ref<string | null>(null);
const isChecking = ref(false);
const isDismissed = ref(sessionStorage.getItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT) === 'true');

export default function useVersionCheck() {
  const performVersionCheck = async (serverUrl: string): Promise<void> => {
    if (isChecking.value) return;

    try {
      isChecking.value = true;

      const currentVersion = await window.electronAPI.local.update.getVerison();
      const response = await checkVersion(serverUrl, currentVersion);

      updateUrl.value = response.updateUrl;
      latestVersion.value = response.latestSupportedVersion;

      if (response.belowMinimumVersion) {
        versionStatus.value = 'belowMinimum';
      } else if (response.updateAvailable) {
        versionStatus.value = 'updateAvailable';
      } else {
        versionStatus.value = 'current';
      }
    } catch (error) {
      console.error('Version check failed:', error);
      versionStatus.value = 'current';
    } finally {
      isChecking.value = false;
    }
  };

  const dismissOptionalUpdate = (): void => {
    sessionStorage.setItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT, 'true');
    isDismissed.value = true;
  };

  const reset = (): void => {
    versionStatus.value = null;
    updateUrl.value = null;
    latestVersion.value = null;
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
