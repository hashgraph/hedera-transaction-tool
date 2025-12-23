import { ref } from 'vue';

import type { IVersionCheckResponse } from '@shared/interfaces';
import type { CompatibilityCheckResult } from '@renderer/services/organization/versionCompatibility';

export type VersionStatus = 'current' | 'updateAvailable' | 'belowMinimum' | null;

export const versionStatus = ref<VersionStatus>(null);
export const updateUrl = ref<string | null>(null);
export const latestVersion = ref<string | null>(null);

export const organizationVersionStatus = ref<{ [serverUrl: string]: VersionStatus }>({});
export const organizationUpdateUrls = ref<{ [serverUrl: string]: string | null }>({});
export const organizationLatestVersions = ref<{ [serverUrl: string]: string | null }>({});
export const organizationMinimumVersions = ref<{ [serverUrl: string]: string | null }>({});
export const organizationVersionData = ref<{ [serverUrl: string]: IVersionCheckResponse | null }>(
  {},
);

export const organizationCompatibilityResults = ref<{
  [serverUrl: string]: CompatibilityCheckResult | null;
}>({});

export const triggeringOrganizationServerUrl = ref<string | null>(null);

export const organizationUpdateTimestamps = ref<{ [serverUrl: string]: Date }>({});

export const setVersionBelowMinimum = (
  serverUrlOrUrl: string | null,
  url?: string | null,
): void => {
  if (url === undefined) {
    versionStatus.value = 'belowMinimum';
    updateUrl.value = serverUrlOrUrl;
    return;
  }

  const serverUrl = serverUrlOrUrl;
  if (serverUrl) {
    organizationVersionStatus.value[serverUrl] = 'belowMinimum';
    organizationUpdateUrls.value[serverUrl] = url;
    organizationUpdateTimestamps.value[serverUrl] = new Date();
    triggeringOrganizationServerUrl.value = serverUrl;
  } else {
    versionStatus.value = 'belowMinimum';
    updateUrl.value = url;
  }
};

export const getVersionStatusForOrg = (serverUrl: string): VersionStatus => {
  return organizationVersionStatus.value[serverUrl] || null;
};

export const getLatestVersionForOrg = (serverUrl: string): string | null => {
  return organizationLatestVersions.value[serverUrl] || null;
};

export const getMinimumVersionForOrg = (serverUrl: string): string | null => {
  return organizationMinimumVersions.value[serverUrl] || null;
};

export const setVersionDataForOrg = (serverUrl: string, data: IVersionCheckResponse): void => {
  organizationVersionData.value[serverUrl] = data;
  organizationLatestVersions.value[serverUrl] = data.latestSupportedVersion;
  organizationMinimumVersions.value[serverUrl] = data.minimumSupportedVersion;
  organizationUpdateUrls.value[serverUrl] = data.updateUrl;
};

export const setVersionStatusForOrg = (serverUrl: string, status: VersionStatus): void => {
  organizationVersionStatus.value[serverUrl] = status;
};

export const resetVersionStatusForOrg = (serverUrl: string): void => {
  delete organizationVersionStatus.value[serverUrl];
  delete organizationUpdateUrls.value[serverUrl];
  delete organizationLatestVersions.value[serverUrl];
  delete organizationMinimumVersions.value[serverUrl];
  delete organizationVersionData.value[serverUrl];
  delete organizationUpdateTimestamps.value[serverUrl];
  delete organizationCompatibilityResults.value[serverUrl];

  // If this was the triggering org, find the next most recent one
  if (triggeringOrganizationServerUrl.value === serverUrl) {
    const orgsRequiringUpdate = Object.entries(organizationVersionStatus.value)
      .filter(([, status]) => status === 'belowMinimum')
      .map(([url]) => ({
        serverUrl: url,
        timestamp: organizationUpdateTimestamps.value[url],
      }))
      .filter(org => org.timestamp)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    triggeringOrganizationServerUrl.value =
      orgsRequiringUpdate.length > 0 ? orgsRequiringUpdate[0].serverUrl : null;
  }
};

export const getAllOrganizationVersions = (): {
  [serverUrl: string]: IVersionCheckResponse;
} => {
  const result: { [serverUrl: string]: IVersionCheckResponse } = {};
  for (const [serverUrl, data] of Object.entries(organizationVersionData.value)) {
    if (data) {
      result[serverUrl] = data;
    }
  }
  return result;
};

export const resetVersionState = (): void => {
  versionStatus.value = null;
  updateUrl.value = null;
  latestVersion.value = null;
  organizationVersionStatus.value = {};
  organizationUpdateUrls.value = {};
  organizationLatestVersions.value = {};
  organizationMinimumVersions.value = {};
  organizationVersionData.value = {};
  organizationCompatibilityResults.value = {};
  organizationUpdateTimestamps.value = {};
  triggeringOrganizationServerUrl.value = null;
};

export const getMostRecentOrganizationRequiringUpdate = (): string | null => {
  const orgsRequiringUpdate = Object.entries(organizationVersionStatus.value)
    .filter(([, status]) => status === 'belowMinimum')
    .map(([url]) => ({
      serverUrl: url,
      timestamp: organizationUpdateTimestamps.value[url],
    }))
    .filter(org => org.timestamp)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return orgsRequiringUpdate.length > 0 ? orgsRequiringUpdate[0].serverUrl : null;
};
