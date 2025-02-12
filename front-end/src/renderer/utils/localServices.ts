import { SKIPPED_ORGAIZATION_SETUP } from '@main/shared/constants';

export const buildSkipClaimKey = (
  serverUrl: string,
  organizationUserId: string | number,
): string => {
  return `${serverUrl}${organizationUserId}${SKIPPED_ORGAIZATION_SETUP}`;
};
