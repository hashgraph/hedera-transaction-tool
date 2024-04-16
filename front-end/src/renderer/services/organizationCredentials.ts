import { getMessageFromIPCError } from '@renderer/utils';

/* Organizations Service */

/* Get the connected organizations */
export const getConnectedOrganizations = async (user_id: string) => {
  try {
    return await window.electronAPI.local.organizationCredentials.getConnectedOrganizations(
      user_id,
    );
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to fetch organizations'));
  }
};

/* Returns the organizations that the user should sign into */
export const getOrganizationsToSignIn = async (user_id: string) => {
  try {
    return await window.electronAPI.local.organizationCredentials.organizationsToSignIn(user_id);
  } catch (error: any) {
    throw Error(
      getMessageFromIPCError(error, 'Failed to fetch organizations that user should sign in'),
    );
  }
};

/* Returns whether the user should sign in a specific organization */
export const shouldSignInOrganization = async (user_id: string, organization_id: string) => {
  try {
    return await window.electronAPI.local.organizationCredentials.shouldSignInOrganization(
      user_id,
      organization_id,
    );
  } catch (error: any) {
    throw Error(
      getMessageFromIPCError(error, 'Failed to determine whether user should sign in organization'),
    );
  }
};

/* Adds a new organization credentials to the user */
export const addOrganizationCredentials = async (
  email: string,
  password: string,
  organization_id: string,
  user_id: string,
  encryptPassword: string,
  updateIfExists: boolean = false,
) => {
  try {
    return await window.electronAPI.local.organizationCredentials.addOrganizationCredentials(
      email,
      password,
      organization_id,
      user_id,
      encryptPassword,
      updateIfExists,
    );
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to store organization credentials'));
  }
};

/* Updates the organization credentials */
export const updateOrganizationCredentials = async (
  organization_id: string,
  user_id: string,
  email?: string,
  password?: string,
  encryptPassword?: string,
) => {
  try {
    return await window.electronAPI.local.organizationCredentials.updateOrganizationCredentials(
      organization_id,
      user_id,
      email,
      password,
      encryptPassword,
    );
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to store organization credentials'));
  }
};

/* Deletes the organization credentials */
export const deleteOrganizationCredentials = async (organization_id: string, user_id: string) => {
  try {
    return await window.electronAPI.local.organizationCredentials.deleteOrganizationCredentials(
      organization_id,
      user_id,
    );
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to delete organization credentials'));
  }
};

/* Try auto sign in */
export const tryAutoSignIn = async (user_id: string, decryptPassword: string) => {
  try {
    return await window.electronAPI.local.organizationCredentials.tryAutoSignIn(
      user_id,
      decryptPassword,
    );
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed failed to auto sign in to organizations'));
  }
};
