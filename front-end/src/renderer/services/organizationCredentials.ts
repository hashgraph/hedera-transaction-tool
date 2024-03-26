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

/* Returns the organizations that the user should sign into */
export const getOrganizationsToSignIn = async (user_id: string) => {
  try {
    return await window.electronAPI.organizationCredentials.organizationsToSignIn(user_id);
  } catch (error: any) {
    throw Error(
      getMessageFromIPCError(error, 'Failed to fetch organizations that user should sign in'),
    );
  }
};

/* Returns whether the user should sign in a specific organization */
export const shouldSignInOrganization = async (user_id: string, organization_id: string) => {
  try {
    return await window.electronAPI.organizationCredentials.shouldSignInOrganization(
      user_id,
      organization_id,
    );
  } catch (error: any) {
    throw Error(
      getMessageFromIPCError(error, 'Failed to determine whether user should sign in organization'),
    );
  }
};
