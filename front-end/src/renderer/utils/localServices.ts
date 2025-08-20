import { SKIPPED_ORGANIZATION_SETUP } from '@shared/constants';

const EXPORT_FORMAT = 'exportFormat';

export const buildSkipClaimKey = (
  serverUrl: string,
  organizationUserId: string | number,
): string => {
  return `${serverUrl}${organizationUserId}${SKIPPED_ORGANIZATION_SETUP}`;
};

export const getLastExportFormat = () => {
  return localStorage.getItem(EXPORT_FORMAT);
};

export const setLastExportFormat = (ext: string) => {
  localStorage.setItem(EXPORT_FORMAT, ext);
};
