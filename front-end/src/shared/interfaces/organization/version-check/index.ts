export interface IVersionCheckResponse {
  success: boolean;
  latestSupportedVersion: string | null;
  minimumSupportedVersion: string | null;
  updateUrl: string | null;
  updateAvailable: boolean;
  belowMinimumVersion: boolean;
}
