import { Prisma } from '@prisma/client';

import { commonIPCHandler } from '@renderer/utils';

/* Organizations Service */

/* Get organizations */
export const getOrganizations = async () =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.organizations.getOrganizations();
  }, 'Failed to fetch organizations');

/* Adds organizations */
export const addOrganization = async (organization: Prisma.OrganizationCreateInput) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.organizations.addOrganization(organization);
  }, 'Failed to add organization');

/* Updates organizations */
export const updateOrganization = async (
  id: string,
  organization: Prisma.OrganizationUncheckedUpdateWithoutOrganizationCredentialsInput,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.organizations.updateOrganization(id, organization);
  }, `Failed to update organization with id: ${id}`);

/* Deletes organizations */
export const deleteOrganization = async (id: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.organizations.deleteOrganization(id);
  }, `Failed to delete transaction with id: ${id}`);
