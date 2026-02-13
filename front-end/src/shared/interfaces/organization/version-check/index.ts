export interface IVersionCheckResponse {
  latestSupportedVersion: string;
  minimumSupportedVersion: string;
  updateUrl: string | null;
}
