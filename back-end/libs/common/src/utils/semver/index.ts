import * as semver from 'semver';

export interface VersionCheckResult {
  latestSupportedVersion: string;
  minimumSupportedVersion: string;
  updateUrl: string | null;
}

export function checkFrontendVersion(
  userVersion: string,
  latestSupported: string | undefined | null,
  minimumSupported: string | undefined | null,
  repoUrl: string | undefined | null,
): VersionCheckResult {
  const result: VersionCheckResult = {
    latestSupportedVersion: latestSupported ?? '',
    minimumSupportedVersion: minimumSupported ?? '',
    updateUrl: null,
  };

  const cleanUserVersion = semver.clean(userVersion);

  if (!cleanUserVersion) {
    return result;
  }

  if (latestSupported) {
    const cleanLatest = semver.clean(latestSupported);
    if (cleanLatest && semver.lt(cleanUserVersion, cleanLatest)) {
      if (repoUrl) {
        const baseUrl = repoUrl.replace(/\/+$/, '');
        result.updateUrl = `${baseUrl}/v${cleanLatest}/`;
      }
    }
  }

  return result;
}

export function isUpdateAvailable(
  clientVersion: string,
  latestSupported: string | undefined | null,
): boolean {
  if (!latestSupported) return false;

  const cleanClient = semver.clean(clientVersion);
  const cleanLatest = semver.clean(latestSupported);

  if (!cleanClient || !cleanLatest) return false;

  return semver.lt(cleanClient, cleanLatest);
}
