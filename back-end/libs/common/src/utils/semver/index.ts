import * as semver from 'semver';

export interface VersionCheckResult {
  latestSupportedVersion: string;
  minimumSupportedVersion: string;
  updateUrl: string | null;
  updateAvailable: boolean;
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
    updateAvailable: false,
  };

  const cleanUserVersion = semver.clean(userVersion);

  if (!cleanUserVersion) {
    return result;
  }

  if (latestSupported) {
    const cleanLatest = semver.clean(latestSupported);
    if (cleanLatest && semver.lt(cleanUserVersion, cleanLatest)) {
      result.updateAvailable = true;

      if (repoUrl) {
        const baseUrl = repoUrl.replace(/\/+$/, '');
        result.updateUrl = `${baseUrl}/tag/v${cleanLatest}`;
      }
    }
  }

  return result;
}
