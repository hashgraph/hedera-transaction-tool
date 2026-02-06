import { computed, ref } from 'vue';

import type { IVersionCheckResponse } from '@shared/interfaces';
import type { CompatibilityCheckResult } from '@renderer/services/organization/versionCompatibility';

export type VersionStatus = 'current' | 'updateAvailable' | 'belowMinimum' | null;

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

export const organizationUpdateTimestamps = ref<{ [serverUrl: string]: Date }>({});

// Helper to get orgs needing attention, ordered by most recent
const getOrgsNeedingUpdateOrdered = (): { serverUrl: string; timestamp: Date }[] => {
  return Object.entries(organizationVersionStatus.value)
    .filter(([, status]) => status === 'updateAvailable' || status === 'belowMinimum')
    .map(([serverUrl]) => ({
      serverUrl,
      timestamp: organizationUpdateTimestamps.value[serverUrl],
    }))
    .filter(org => org.timestamp)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export const versionStatus = computed<VersionStatus>(() => {
  const statuses: VersionStatus[] = Object.values(organizationVersionStatus.value);

  if (!statuses.length) return null;
  if (statuses.includes('belowMinimum')) return 'belowMinimum';
  if (statuses.includes('updateAvailable')) return 'updateAvailable';
  if (statuses.every((s) => s === 'current')) return 'current';
  return null;
});

// Global computed updateUrl based on org statuses
export const updateUrl = computed<string | null>(() => {
  const orgsNeedingUpdate = getOrgsNeedingUpdateOrdered();
  if (!orgsNeedingUpdate.length) return null;

  const selectedOrgUrl = orgsNeedingUpdate[0].serverUrl;
  return organizationUpdateUrls.value[selectedOrgUrl] ?? null;
});

// Global computed latestVersion based on org statuses
export const latestVersion = computed<string | null>(() => {
  const orgsNeedingUpdate = getOrgsNeedingUpdateOrdered();
  if (!orgsNeedingUpdate.length) return null;

  const selectedOrgUrl = orgsNeedingUpdate[0].serverUrl;
  return organizationLatestVersions.value[selectedOrgUrl] ?? null;
});

export const triggeringOrganizationServerUrl = computed<string | null>(() => {
  const orgsNeedingUpdate = getOrgsNeedingUpdateOrdered();
  if (!orgsNeedingUpdate.length) return null;

  return orgsNeedingUpdate[0].serverUrl;
});

export const setOrgVersionBelowMinimum = (serverUrl: string, url: string | null): void => {
  organizationVersionStatus.value[serverUrl] = 'belowMinimum';
  organizationUpdateUrls.value[serverUrl] = url;
  organizationUpdateTimestamps.value[serverUrl] = new Date();
};

export const getVersionStatusForOrg = (serverUrl: string): VersionStatus => {
  return organizationVersionStatus.value[serverUrl] || null;
};

export const getLatestVersionForOrg = (serverUrl: string): string | null => {
  return organizationLatestVersions.value[serverUrl] || null;
};

export const setVersionDataForOrg = (serverUrl: string, data: IVersionCheckResponse): void => {
  organizationVersionData.value[serverUrl] = data;
  organizationLatestVersions.value[serverUrl] = data.latestSupportedVersion;
  organizationMinimumVersions.value[serverUrl] = data.minimumSupportedVersion;
  organizationUpdateUrls.value[serverUrl] = data.updateUrl;
  organizationUpdateTimestamps.value[serverUrl] = new Date();
};

export const setVersionStatusForOrg = (serverUrl: string, status: VersionStatus): void => {
  organizationVersionStatus.value[serverUrl] = status;
  organizationUpdateTimestamps.value[serverUrl] = new Date();
};

export const resetVersionStatusForOrg = (serverUrl: string): void => {
  delete organizationVersionStatus.value[serverUrl];
  delete organizationUpdateUrls.value[serverUrl];
  delete organizationLatestVersions.value[serverUrl];
  delete organizationMinimumVersions.value[serverUrl];
  delete organizationVersionData.value[serverUrl];
  delete organizationUpdateTimestamps.value[serverUrl];
  delete organizationCompatibilityResults.value[serverUrl];
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
  organizationVersionStatus.value = {};
  organizationUpdateUrls.value = {};
  organizationLatestVersions.value = {};
  organizationMinimumVersions.value = {};
  organizationVersionData.value = {};
  organizationCompatibilityResults.value = {};
  organizationUpdateTimestamps.value = {};
};

export const getMostRecentOrganizationRequiringUpdate = (): string | null => {
  const orgsRequiringUpdate = getOrgsNeedingUpdateOrdered();

  return orgsRequiringUpdate.length > 0 ? orgsRequiringUpdate[0].serverUrl : null;
};
