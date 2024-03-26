import { getMessageFromIPCError } from '@renderer/utils';

/* User service for organization */

/* Get information about current user */
export const getUserState = async (
  organizationId: string,
  userId: string,
): Promise<{
  passwordTemporary: boolean;
  secretHashes: string[];
}> => {
  try {
    return await window.electronAPI.organization.user.me(organizationId, userId);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to get information about user state'));
  }
};
