import * as semver from 'semver';

import type { IVersionCheckResponse } from '@shared/interfaces';

import { FRONTEND_VERSION } from '@renderer/utils/version';

export type CompatibilityConflict = {
  serverUrl: string;
  organizationName: string;
  latestSupportedVersion: string | null;
  suggestedVersion: string;
};

export type CompatibilityCheckResult = {
  hasConflict: boolean;
  conflicts: CompatibilityConflict[];
  suggestedVersion: string | null;
  isOptional: boolean;
};

/**
 * Pure comparison primitive. Reports any organizations whose latest supported
 * version is below `suggestedVersion`. Takes its inputs explicitly so it has
 * no dependency on the version store and can be composed into a `computed`
 * without creating an import cycle. No logging — this runs on every reactive
 * recompute; any signal worth logging belongs at the event boundary where
 * fresh data lands.
 */
export function checkCompatibilityAcrossOrganizations(
  suggestedVersion: string,
  organizations: Array<{ serverUrl: string; nickname?: string }>,
  latestVersionByServer: { [serverUrl: string]: string | null },
  excludingServerUrl?: string,
): CompatibilityCheckResult {
  const conflicts: CompatibilityConflict[] = [];

  const cleanSuggestedVersion = semver.clean(suggestedVersion);
  if (!cleanSuggestedVersion) {
    return {
      hasConflict: false,
      conflicts: [],
      suggestedVersion: null,
      isOptional: true,
    };
  }

  for (const org of organizations) {
    if (excludingServerUrl && org.serverUrl === excludingServerUrl) {
      continue;
    }

    const orgLatestVersion = latestVersionByServer[org.serverUrl] ?? null;
    if (!orgLatestVersion) continue;

    const cleanOrgLatestVersion = semver.clean(orgLatestVersion);
    if (!cleanOrgLatestVersion) continue;

    if (semver.gt(cleanSuggestedVersion, cleanOrgLatestVersion)) {
      conflicts.push({
        serverUrl: org.serverUrl,
        organizationName: org.nickname || org.serverUrl,
        latestSupportedVersion: orgLatestVersion,
        suggestedVersion: cleanSuggestedVersion,
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    suggestedVersion: cleanSuggestedVersion,
    isOptional: true,
  };
}

export function isVersionBelowMinimum(versionData: IVersionCheckResponse): boolean {
  if (!versionData.minimumSupportedVersion) {
    return false;
  }

  const cleanCurrentVersion = semver.clean(FRONTEND_VERSION);
  const cleanMinimumVersion = semver.clean(versionData.minimumSupportedVersion);

  if (!cleanCurrentVersion || !cleanMinimumVersion) {
    return false;
  }

  return semver.lt(cleanCurrentVersion, cleanMinimumVersion);
}
