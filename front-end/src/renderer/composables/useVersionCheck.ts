import { ref } from 'vue';

import type { IVersionCheckResponse } from '@shared/interfaces';
import type { ConnectedOrganization } from '@renderer/types/userStore';

import { SESSION_STORAGE_DISMISSED_UPDATE_PROMPT } from '@shared/constants';

import { checkVersion } from '@renderer/services/organization';
import { FRONTEND_VERSION } from '@renderer/utils/version';

import useUserStore from '@renderer/stores/storeUser';

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

const isChecking = ref(false);
const isDismissed = ref(sessionStorage.getItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT) === 'true');

export default function useVersionCheck() {
  const user = useUserStore();

  const performVersionCheck = async (serverUrl: string): Promise<void> => {
    if (isChecking.value) return;

    try {
      isChecking.value = true;

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

      updateUrl.value = response.updateUrl;
      latestVersion.value = response.latestSupportedVersion;
      versionStatus.value = response.updateUrl ? 'updateAvailable' : 'current';
    } catch (error) {
      console.error('Version check failed:', error);
      const orgStatus = getVersionStatusForOrg(serverUrl);
      if (orgStatus !== 'belowMinimum') {
        setVersionStatusForOrg(serverUrl, 'current');
      }
      if (versionStatus.value !== 'belowMinimum') {
        versionStatus.value = 'current';
      }
    } finally {
      isChecking.value = false;
    }
  };

  const getVersionStatusForOrganization = (serverUrl: string): VersionStatus => {
    return getVersionStatusForOrg(serverUrl);
  };

  const getAffectedOrganization = (): ConnectedOrganization | null => {
    return (
      user.organizations.find(org => getVersionStatusForOrg(org.serverUrl) === 'belowMinimum') ||
      null
    );
  };

  const hasOrganizationRequiringUpdate = (): boolean => {
    return user.organizations.some(org => getVersionStatusForOrg(org.serverUrl) === 'belowMinimum');
  };

  const getLatestVersionForOrganization = (serverUrl: string): string | null => {
    const allVersions = getAllOrganizationVersions();
    return allVersions[serverUrl]?.latestSupportedVersion || null;
  };

  const getMinimumVersionForOrganization = (serverUrl: string): string | null => {
    const allVersions = getAllOrganizationVersions();
    return allVersions[serverUrl]?.minimumSupportedVersion || null;
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
    // New per-organization methods
    getVersionStatusForOrganization,
    getAffectedOrganization,
    hasOrganizationRequiringUpdate,
    getLatestVersionForOrganization,
    getMinimumVersionForOrganization,
    storeVersionDataForOrganization,
    getAllOrganizationVersionData,
  };
}

export type { VersionStatus };
