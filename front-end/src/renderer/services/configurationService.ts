import { getMessageFromIPCError } from '@renderer/utils';
import { IOrganization } from '@main/shared/interfaces';

/* Configuration service */

/* Organizations */
/* Get Organizations */
export const getOrganizations = async () => {
  try {
    return await window.electronAPI.config.organizations.getAll();
  } catch (err: any) {
    return [];
  }
};

/* Add Organization */
export const addOrganization = async (organization: IOrganization) => {
  try {
    await window.electronAPI.config.organizations.add(organization);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to add organization'));
  }
};

/* Remove Organization */
export const removeOrganization = async (severUrl: string) => {
  try {
    await window.electronAPI.config.organizations.removeByServerURL(severUrl);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to remove organization'));
  }
};
