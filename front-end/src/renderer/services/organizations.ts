import { Prisma } from '@prisma/client';

import { getMessageFromIPCError } from '@renderer/utils';

/* Organizations Service */

/* Get organizations */
export const getOrganizations = async (user_id: string) => {
  try {
    return await window.electronAPI.organizations.getOrganizations(user_id);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to fetch organizations'));
  }
};

/* Adds organizations */
export const addDraft = async (organization: Prisma.OrganizationCreateInput) => {
  try {
    return await window.electronAPI.organizations.addOrganization(organization);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to add organization'));
  }
};

/* Updates organizations */
export const updateDraft = async (
  id: string,
  organization: Prisma.OrganizationUncheckedUpdateWithoutOrganizationCredentialsInput,
) => {
  try {
    return await window.electronAPI.organizations.updateOrganization(id, organization);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to update organization with id: ${id}`));
  }
};

/* Deletes organizations */
export const deleteDraft = async (id: string) => {
  try {
    return await window.electronAPI.transactionDrafts.deleteDraft(id);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to delete transaction with id: ${id}`));
  }
};
