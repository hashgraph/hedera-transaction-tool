import { Organization, SchemaProperties } from '../../main/modules/store';

/* Mirror Node Links */

export const getMirrorNodeConfig = () => window.electronAPI.config.mirrorNodeLinks.getLinks();

export const setMirrorNodeLink = (key: keyof SchemaProperties['mirrorNodeLinks'], link: string) =>
  window.electronAPI.config.mirrorNodeLinks.setLink(key, link);

/* Organizations*/

export const getOrganizations = () => window.electronAPI.config.organizations.getAll();

export const addOrganization = (organization: Organization) =>
  window.electronAPI.config.organizations.add(organization);

export const removeOrganization = (severUrl: string) =>
  window.electronAPI.config.organizations.removeByServerURL(severUrl);
