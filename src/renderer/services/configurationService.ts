import { Organization } from '../../main/modules/store';

/* Organizations*/

export const getOrganizations = () => window.electronAPI.config.organizations.getAll();

export const addOrganization = (organization: Organization) =>
  window.electronAPI.config.organizations.add(organization);

export const removeOrganization = (severUrl: string) =>
  window.electronAPI.config.organizations.removeByServerURL(severUrl);
