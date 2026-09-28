export interface IVersionCheckResponse {
  latestSupportedVersion: string;
  minimumSupportedVersion: string;
  /**
   * @deprecated The client now constructs the download URL from `latestSupportedVersion`
   * using a hardcoded trusted base, so this field is no longer used for downloads.
   * It is kept for backwards compatibility and still serves as a truthy signal that
   * an update is available. Remove once all backends have migrated to sending an
   * explicit `updateAvailable` flag.
   */
  updateUrl: string | null;
}
