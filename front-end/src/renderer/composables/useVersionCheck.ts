import { computed, ref } from 'vue';

import type { IVersionCheckResponse } from '@shared/interfaces';

import { SESSION_STORAGE_DISMISSED_UPDATE_PROMPT } from '@shared/constants';

import { checkVersion } from '@renderer/services/organization';
import { FRONTEND_VERSION } from '@renderer/utils/version';

import {
  versionStatus,
  updateUrl,
  latestVersion,
  resetVersionState,
  setVersionDataForOrg,
  setVersionStatusForOrg,
  getVersionStatusForOrg,
  getAllOrganizationVersions,
  type VersionStatus,
} from '@renderer/stores/versionState';

const isDismissed = ref(sessionStorage.getItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT) === 'true');

// per org checking flags
const orgChecks = ref<Record<string, boolean>>({});

// optional: global "any check running"
const isAnyChecking = computed(() =>
  Object.values(orgChecks.value).some((v) => v),
);

export default function useVersionCheck() {
  const performVersionCheck = async (serverUrl: string): Promise<void> => {
    if (orgChecks.value[serverUrl]) {
      return;
    }

    try {
      orgChecks.value[serverUrl] = true;

      const response = await checkVersion(serverUrl, FRONTEND_VERSION);

      setVersionDataForOrg(serverUrl, {
        latestSupportedVersion: response.latestSupportedVersion,
        minimumSupportedVersion: response.minimumSupportedVersion,
        updateUrl: response.updateUrl,
      });

      if (response.updateUrl) {
        setVersionStatusForOrg(serverUrl, 'updateAvailable');
      } else {
        setVersionStatusForOrg(serverUrl, 'current');
      }
    } catch (error) {
      console.error('Version check failed:', error);
      const orgStatus = getVersionStatusForOrg(serverUrl);
      if (orgStatus !== 'belowMinimum') {
        setVersionStatusForOrg(serverUrl, 'current');
      }
    } finally {
      orgChecks.value[serverUrl] = false;
    }
  };

  const storeVersionDataForOrganization = (
    serverUrl: string,
    data: IVersionCheckResponse,
  ): void => {
    setVersionDataForOrg(serverUrl, data);
  };

  const getAllOrganizationVersionData = (): { [serverUrl: string]: IVersionCheckResponse } => {
    return getAllOrganizationVersions();
  };

  const dismissOptionalUpdate = (): void => {
    sessionStorage.setItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT, 'true');
    isDismissed.value = true;
  };

  const reset = (): void => {
    resetVersionState();
    isDismissed.value = false;
    orgChecks.value = {}; // clear flags on reset
    sessionStorage.removeItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT);
  };

  return {
    versionStatus,
    updateUrl,
    latestVersion,
    performVersionCheck,
    isDismissed,
    orgChecks,
    isAnyChecking,
    dismissOptionalUpdate,
    reset,
    storeVersionDataForOrganization,
    getAllOrganizationVersionData,
  };
}

export type { VersionStatus };
