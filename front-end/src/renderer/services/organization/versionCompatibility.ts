import * as semver from 'semver';

import type { IVersionCheckResponse } from '@shared/interfaces';

import { FRONTEND_VERSION } from '@renderer/utils/version';

import useUserStore from '@renderer/stores/storeUser';
import { getLatestVersionForOrg } from '@renderer/stores/versionState';

export type CompatibilityConflict = {
  serverUrl: string;
  organizationName: string;
  latestSupportedVersion: string;
  suggestedVersion: string;
};

export type CompatibilityCheckResult = {
  hasConflict: boolean;
  conflicts: CompatibilityConflict[];
  suggestedVersion: string | null;
  isOptional: boolean;
};

export async function checkCompatibilityAcrossOrganizations(
  suggestedVersion: string,
  excludingServerUrl?: string,
): Promise<CompatibilityCheckResult> {
  const userStore = useUserStore();
  const conflicts: CompatibilityConflict[] = [];

  const cleanSuggestedVersion = semver.clean(suggestedVersion);
  if (!cleanSuggestedVersion) {
    console.warn(`Invalid suggested version format: ${suggestedVersion}`);
    return {
      hasConflict: false,
      conflicts: [],
      suggestedVersion: null,
      isOptional: true,
    };
  }

  for (const org of userStore.organizations) {
    if (excludingServerUrl && org.serverUrl === excludingServerUrl) {
      continue;
    }

    const orgLatestVersion = getLatestVersionForOrg(org.serverUrl);

    if (!orgLatestVersion) {
      continue;
    }

    const cleanOrgLatestVersion = semver.clean(orgLatestVersion);
    if (!cleanOrgLatestVersion) {
      console.warn(`Invalid version format for org ${org.serverUrl}: ${orgLatestVersion}`);
      continue;
    }

    if (semver.gt(cleanSuggestedVersion, cleanOrgLatestVersion)) {
      conflicts.push({
        serverUrl: org.serverUrl,
        organizationName: org.nickname || org.serverUrl,
        latestSupportedVersion: orgLatestVersion,
        suggestedVersion: cleanSuggestedVersion,
      });
    }
  }

  if (conflicts.length > 0) {
    console.warn(
      `[${new Date().toISOString()}] COMPATIBILITY_CHECK Suggested version: ${cleanSuggestedVersion}`,
    );
    console.warn(
      `Conflicts found with ${conflicts.length} organization(s):`,
      conflicts.map(c => `${c.organizationName} (latest: ${c.latestSupportedVersion})`),
    );
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    suggestedVersion: cleanSuggestedVersion,
    isOptional: true,
  };
}

export async function checkCompatibilityForNewOrg(
  newOrgServerUrl: string,
  newOrgVersionData: IVersionCheckResponse,
): Promise<CompatibilityCheckResult> {
  if (!newOrgVersionData.updateUrl) {
    return {
      hasConflict: false,
      conflicts: [],
      suggestedVersion: null,
      isOptional: true,
    };
  }

  const cleanCurrentVersion = semver.clean(FRONTEND_VERSION);
  const cleanMinimumVersion = newOrgVersionData.minimumSupportedVersion
    ? semver.clean(newOrgVersionData.minimumSupportedVersion)
    : null;

  const isOptional =
    !cleanCurrentVersion || !cleanMinimumVersion
      ? true
      : semver.gte(cleanCurrentVersion, cleanMinimumVersion);

  const suggestedVersion = newOrgVersionData.latestSupportedVersion;

  const result = await checkCompatibilityAcrossOrganizations(suggestedVersion, newOrgServerUrl);

  return {
    ...result,
    isOptional,
  };
}

export function getConflictingOrganizations(
  suggestedVersion: string,
  excludingServerUrl?: string,
): CompatibilityConflict[] {
  const userStore = useUserStore();
  const conflicts: CompatibilityConflict[] = [];

  const cleanSuggestedVersion = semver.clean(suggestedVersion);
  if (!cleanSuggestedVersion) {
    return conflicts;
  }

  for (const org of userStore.organizations) {
    if (excludingServerUrl && org.serverUrl === excludingServerUrl) {
      continue;
    }

    const orgLatestVersion = getLatestVersionForOrg(org.serverUrl);
    if (!orgLatestVersion) {
      continue;
    }

    const cleanOrgLatestVersion = semver.clean(orgLatestVersion);
    if (!cleanOrgLatestVersion) {
      continue;
    }

    if (semver.gt(cleanSuggestedVersion, cleanOrgLatestVersion)) {
      conflicts.push({
        serverUrl: org.serverUrl,
        organizationName: org.nickname || org.serverUrl,
        latestSupportedVersion: orgLatestVersion,
        suggestedVersion: cleanSuggestedVersion,
      });
    }
  }

  return conflicts;
}

export function isUpgradeOptional(versionData: IVersionCheckResponse): boolean {
  if (!versionData.updateUrl) {
    return true;
  }

  return true;
}
