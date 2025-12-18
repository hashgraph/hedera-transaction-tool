import { ref } from 'vue';

import { SESSION_STORAGE_DISMISSED_UPDATE_PROMPT } from '@shared/constants';

import { checkVersion } from '@renderer/services/organization';
import { FRONTEND_VERSION } from '@renderer/utils/version';

export type VersionStatus = 'current' | 'updateAvailable' | null;

const versionStatus = ref<VersionStatus>(null);
const updateUrl = ref<string | null>(null);
const latestVersion = ref<string | null>(null);
const isChecking = ref(false);

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
      versionStatus.value = 'current';
    } finally {
      isChecking.value = false;
    }
  };

  const isDismissed = (): boolean => {
    return sessionStorage.getItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT) === 'true';
  };

  const dismissOptionalUpdate = (): void => {
    sessionStorage.setItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT, 'true');
  };

  const reset = (): void => {
    versionStatus.value = null;
    updateUrl.value = null;
    latestVersion.value = null;
    isChecking.value = false;
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
