import { ipcMain } from 'electron';

import {
  getConnectedOrganizations,
  organizationsToSignIn,
  shouldSignInOrganization,
  addOrganizationCredentials,
  updateOrganizationCredentials,
  deleteOrganizationCredentials,
} from '@main/services/localUser';

const createChannelName = (...props) => ['organizationCredentials', ...props].join(':');

export default () => {
  /* Organization Credentials */

  /* Get all connected organizations */
  ipcMain.handle(createChannelName('getConnectedOrganizations'), (_e, user_id: string) =>
    getConnectedOrganizations(user_id),
  );

  /* Get all organizations that user should sign in */
  ipcMain.handle(createChannelName('organizationsToSignIn'), (_e, user_id: string) =>
    organizationsToSignIn(user_id),
  );

  /* Returns whether the user should sign in a specific organization */
  ipcMain.handle(
    createChannelName('shouldSignInOrganization'),
    (_e, user_id: string, organization_id: string) =>
      shouldSignInOrganization(user_id, organization_id),
  );

  /* Adds a new organization credentials to the user */
  ipcMain.handle(
    createChannelName('addOrganizationCredentials'),
    (
      _e,
      email: string,
      password: string,
      organization_id: string,
      user_id: string,
      jwtToken: string,
      encryptPassword: string,
      updateIfExists: boolean = false,
    ) =>
      addOrganizationCredentials(
        email,
        password,
        organization_id,
        user_id,
        jwtToken,
        encryptPassword,
        updateIfExists,
      ),
  );

  /* Updates the organization credentials */
  ipcMain.handle(
    createChannelName('updateOrganizationCredentials'),
    (
      _e,
      organization_id: string,
      user_id: string,
      email?: string,
      password?: string,
      jwtToken?: string,
      encryptPassword?: string,
    ) =>
      updateOrganizationCredentials(
        organization_id,
        user_id,
        email,
        password,
        jwtToken,
        encryptPassword,
      ),
  );

  /* Delete organization credentials */
  ipcMain.handle(
    createChannelName('deleteOrganizationCredentials'),
    (_e, organization_id: string, user_id: string) =>
      deleteOrganizationCredentials(organization_id, user_id),
  );
};
