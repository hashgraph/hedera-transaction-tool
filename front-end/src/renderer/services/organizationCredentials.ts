import { commonIPCHandler } from '@renderer/utils';

/* Organizations Service */

/* Get the organization ids with tokens */
export const getOrganizationTokens = async (user_id: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.organizationCredentials.getOrganizationTokens(user_id);
  }, 'Failed to fetch organization tokens');

/* Returns the organizations that the user should sign into */
export const getOrganizationsToSignIn = async (user_id: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.organizationCredentials.organizationsToSignIn(user_id);
  }, 'Failed to fetch organizations that user should sign in');

/* Returns whether the user should sign in a specific organization */
export const shouldSignInOrganization = async (user_id: string, organization_id: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.organizationCredentials.shouldSignInOrganization(
      user_id,
      organization_id,
    );
  }, 'Failed to determine whether user should sign in organization');

/* Adds a new organization credentials to the user */
export const addOrganizationCredentials = async (
  email: string,
  password: string,
  organization_id: string,
  user_id: string,
  jwtToken: string,
  encryptPassword: string | null,
  updateIfExists: boolean = false,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.organizationCredentials.addOrganizationCredentials(
      email,
      password,
      organization_id,
      user_id,
      jwtToken,
      encryptPassword,
      updateIfExists,
    );
  }, 'Failed to store organization credentials');

/* Updates the organization credentials */
export const updateOrganizationCredentials = async (
  organization_id: string,
  user_id: string,
  email?: string,
  password?: string | null,
  jwtToken?: string | null,
  encryptPassword?: string,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.organizationCredentials.updateOrganizationCredentials(
      organization_id,
      user_id,
      email,
      password,
      jwtToken,
      encryptPassword,
    );
  }, 'Failed to store organization credentials');

/* Deletes the organization credentials */
export const deleteOrganizationCredentials = async (organization_id: string, user_id: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.organizationCredentials.deleteOrganizationCredentials(
      organization_id,
      user_id,
    );
  }, 'Failed to delete organization credentials');

export const getOrganizationCredentials = async (organization_id: string, user_id: string, decryptPassword: string | null) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.organizationCredentials.getOrganizationCredentials(
      organization_id,
      user_id,
      decryptPassword,
    );
  }, 'Failed to get organization credentials');

/* Try auto sign in */
export const tryAutoSignIn = async (user_id: string, decryptPassword: string | null) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.organizationCredentials.tryAutoSignIn(
      user_id,
      decryptPassword,
    );
  }, 'Failed failed to auto sign in to organizations');
