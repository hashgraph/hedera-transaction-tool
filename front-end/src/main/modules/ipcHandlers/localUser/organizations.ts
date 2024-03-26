import { ipcMain } from 'electron';

import { Prisma } from '@prisma/client';

import {
  getOrganizations,
  addOrganization,
  updateOrganization,
  removeOrganization,
} from '@main/services/localUser';

const createChannelName = (...props) => ['organizations', ...props].join(':');

export default () => {
  /* Organizations */

  // Get all organizations
  ipcMain.handle(createChannelName('getOrganizations'), (_e, user_id: string) =>
    getOrganizations(user_id),
  );

  // Add a organization
  ipcMain.handle(
    createChannelName('addOrganization'),
    (_e, organization: Prisma.OrganizationCreateInput) => addOrganization(organization),
  );

  // Update a organization
  ipcMain.handle(
    createChannelName('updateOrganization'),
    (
      _e,
      id: string,
      organization: Prisma.OrganizationUncheckedUpdateWithoutOrganizationCredentialsInput,
    ) => updateOrganization(id, organization),
  );

  // Delete specific organization
  ipcMain.handle(createChannelName('deleteOrganization'), (_e, id: string) =>
    removeOrganization(id),
  );
};
