import { getMessageFromIPCError } from '@renderer/utils';

/* Organizations Service */

/* Get the connected organizations */
export const getConnectedOrganizations = async (user_id: string) => {
  try {
    return await window.electronAPI.organizationCredentials.getConnectedOrganizations(user_id);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to fetch organizations'));
  }
};
