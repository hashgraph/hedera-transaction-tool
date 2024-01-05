import { Organization } from '../../main/modules/store';

/* Organizations*/

export const getOrganizations = () => window.electronAPI.config.organizations.getAll();

export const addOrganization = async (organization: Organization) => {
  try {
    await window.electronAPI.config.organizations.add(organization);
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Failed to add organization';
    throw Error(message);
  }
};

export const removeOrganization = async (severUrl: string) => {
  try {
    await window.electronAPI.config.organizations.removeByServerURL(severUrl);
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Failed to remove organization';
    throw Error(message);
  }
};
