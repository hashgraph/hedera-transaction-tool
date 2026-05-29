import { computed, ref } from 'vue';

import type { IVersionCheckResponse } from '@shared/interfaces';
import type { CompatibilityCheckResult } from '@renderer/services/organization/versionCompatibility';

import { LOCAL_STORAGE_ORG_VERSION_DATA } from '@shared/constants';
import useUserStore from '@renderer/stores/storeUser';
import {
  checkCompatibilityAcrossOrganizations,
  isVersionBelowMinimum,
} from '@renderer/services/organization/versionCompatibility';

export type VersionStatus = 'current' | 'updateAvailable' | 'belowMinimum' | null;

type VersionDataMap = { [serverUrl: string]: IVersionCheckResponse };

const isVersionCheckResponse = (
  value: unknown,
): value is IVersionCheckResponse => {
  if (!value || typeof value !== 'object') return false;

  const v = value as Record<string, unknown>;

  return (
    typeof v.latestSupportedVersion === 'string' &&
    typeof v.minimumSupportedVersion === 'string' &&
    (typeof v.updateUrl === 'string' || v.updateUrl === null)
  );
};

const loadPersistedVersionData = (): VersionDataMap => {
  if (typeof localStorage === 'undefined') return {};

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ORG_VERSION_DATA);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const result: VersionDataMap = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (isVersionCheckResponse(value)) {
        result[key] = value;
      }
    }

    return result;
  } catch {
    return {};
  }
};

const persistVersionData = (): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    const toPersist: VersionDataMap = {};
    for (const [serverUrl, data] of Object.entries(organizationVersionData.value)) {
      if (data) toPersist[serverUrl] = data;
    }
    localStorage.setItem(LOCAL_STORAGE_ORG_VERSION_DATA, JSON.stringify(toPersist));
  } catch {
    /* ignore quota / serialization errors */
  }
};

export type InitialVersionCheckState = 'idle' | 'running' | 'done';

// Lifecycle of the startup batch that asks every org for its version.
// Modals gate on `=== 'done'` — anything else means we haven't established
// a complete picture yet, so don't render. Three states keeps the
// "we haven't started" and "we're in flight" cases distinct without
// needing a second flag.
export const initialVersionCheckState = ref<InitialVersionCheckState>('idle');

// Source of truth for cached per-org version data. Keyed by backend URL (not
// by user) so it survives logout and seeds the fallback when a backend
// doesn't respond at the next startup.
export const organizationVersionData = ref<{ [serverUrl: string]: IVersionCheckResponse | null }>(
  loadPersistedVersionData(),
);

export const organizationUpdateTimestamps = ref<{ [serverUrl: string]: Date }>({});

export const organizationUpdateUrls = computed<{ [serverUrl: string]: string | null }>(() => {
  const result: { [serverUrl: string]: string | null } = {};
  for (const [serverUrl, data] of Object.entries(organizationVersionData.value)) {
    if (data) result[serverUrl] = data.updateUrl ?? null;
  }
  return result;
});

export const organizationLatestVersions = computed<{ [serverUrl: string]: string | null }>(() => {
  const result: { [serverUrl: string]: string | null } = {};
  for (const [serverUrl, data] of Object.entries(organizationVersionData.value)) {
    if (data) result[serverUrl] = data.latestSupportedVersion;
  }
  return result;
});

export const organizationMinimumVersions = computed<{ [serverUrl: string]: string | null }>(() => {
  const result: { [serverUrl: string]: string | null } = {};
  for (const [serverUrl, data] of Object.entries(organizationVersionData.value)) {
    if (data) result[serverUrl] = data.minimumSupportedVersion;
  }
  return result;
});

export const organizationVersionStatus = computed<{ [serverUrl: string]: VersionStatus }>(() => {
  const result: { [serverUrl: string]: VersionStatus } = {};
  for (const serverUrl of Object.keys(organizationVersionData.value)) {
    const data = organizationVersionData.value[serverUrl];
    if (!data) continue;
    if (isVersionBelowMinimum(data)) {
      result[serverUrl] = 'belowMinimum';
    } else if (data.updateUrl) {
      result[serverUrl] = 'updateAvailable';
    } else {
      result[serverUrl] = 'current';
    }
  }
  return result;
});

export const organizationCompatibilityResults = computed<{
  [serverUrl: string]: CompatibilityCheckResult | null;
}>(() => {
  const orgs = useUserStore().organizations ?? [];
  const latestMap = organizationLatestVersions.value;

  const result: { [serverUrl: string]: CompatibilityCheckResult | null } = {};
  for (const [serverUrl, data] of Object.entries(organizationVersionData.value)) {
    if (!data?.latestSupportedVersion) {
      result[serverUrl] = null;
      continue;
    }
    result[serverUrl] = checkCompatibilityAcrossOrganizations(
      serverUrl,
      data,
      orgs,
      latestMap,
    );
  }
  return result;
});

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

export const updateUrl = computed<string | null>(() => {
  const orgsNeedingUpdate = getOrgsNeedingUpdateOrdered();
  if (!orgsNeedingUpdate.length) return null;

  const selectedOrgUrl = orgsNeedingUpdate[0].serverUrl;
  return organizationUpdateUrls.value[selectedOrgUrl] ?? null;
});

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

export const getVersionStatusForOrg = (serverUrl: string): VersionStatus => {
  return organizationVersionStatus.value[serverUrl] || null;
};

export const getLatestVersionForOrg = (serverUrl: string): string | null => {
  return organizationLatestVersions.value[serverUrl] || null;
};

export const setVersionDataForOrg = (serverUrl: string, data: IVersionCheckResponse): void => {
  organizationVersionData.value[serverUrl] = data;
  organizationUpdateTimestamps.value[serverUrl] = new Date();
  persistVersionData();
};

export const resetVersionStatusForOrg = (serverUrl: string): void => {
  delete organizationVersionData.value[serverUrl];
  delete organizationUpdateTimestamps.value[serverUrl];
  persistVersionData();
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
  organizationUpdateTimestamps.value = {};
  initialVersionCheckState.value = 'idle';
  // Cached per-org version data survives logout (keyed by backend URL, not
  // user) — rehydrate from disk so the in-memory ref stays aligned with
  // what's persisted.
  organizationVersionData.value = loadPersistedVersionData();
};

export const getMostRecentOrganizationRequiringUpdate = (): string | null => {
  const orgsRequiringUpdate = getOrgsNeedingUpdateOrdered();

  return orgsRequiringUpdate.length > 0 ? orgsRequiringUpdate[0].serverUrl : null;
};
