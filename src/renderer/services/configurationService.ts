import { IOrganization } from 'src/main/shared/interfaces';

/* Configuration service */

/* Organizations */
/* Get Organizations */
export const getOrganizations = () => window.electronAPI.config.organizations.getAll();

/* Add Organization */
export const addOrganization = async (organization: IOrganization) => {
  try {
    await window.electronAPI.config.organizations.add(organization);
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Failed to add organization';
    throw Error(message);
  }
};

/* Remove Organization */
export const removeOrganization = async (severUrl: string) => {
  try {
    await window.electronAPI.config.organizations.removeByServerURL(severUrl);
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Failed to remove organization';
    throw Error(message);
  }
};
