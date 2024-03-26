import { ipcMain } from 'electron';

import { Prisma } from '@prisma/client';

import { getConnectedOrganizations } from '@main/services/localUser';

const createChannelName = (...props) => ['organizationCredentials', ...props].join(':');

export default () => {
  /* Organizations */

  // Get all organizations
  ipcMain.handle(createChannelName('getConnectedOrganizations'), (_e, user_id: string) =>
    getConnectedOrganizations(user_id),
  );
};
