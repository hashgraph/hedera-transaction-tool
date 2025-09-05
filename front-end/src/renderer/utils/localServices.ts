import { SKIPPED_ORGANIZATION_SETUP } from '@shared/constants';

const EXPORT_EXTENSION = 'exportExtension';

export const buildSkipClaimKey = (
  serverUrl: string,
  organizationUserId: string | number,
): string => {
  return `${serverUrl}${organizationUserId}${SKIPPED_ORGANIZATION_SETUP}`;
};

export const getLastExportExtension = () => {
  return localStorage.getItem(EXPORT_EXTENSION);
};

export const setLastExportExtension = (ext: string) => {
  localStorage.setItem(EXPORT_EXTENSION, ext);
};
