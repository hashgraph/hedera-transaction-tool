import { ipcMain } from 'electron';

import { Prisma } from '@prisma/client';

import {
  getConnectedOrganizations,
  organizationsToSignIn,
  shouldSignInOrganization,
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
};
