import getStore, { Organization, SchemaProperties } from '../modules/store';

const store = getStore();

/* Clear Store */
export const clearStore = () => store.clear();

/* Mirror Node Links */
export const getMirrorNodeLinks = () => store.get('mirrorNodeLinks');

export const setMirrorNodeLinks = (
  key: keyof SchemaProperties['mirrorNodeLinks'],
  link: string,
): string => {
  store.set(`mirrorNodeLinks.${key}`, link);
  return store.get(`mirrorNodeLinks.${key}`);
};

/* Organizations */
export const getOrganizations = () => store.get('organizations');

export const addOrganization = (organization: Organization) => {
  if (
    store.store.organizations.some(
      org => org.name === organization.name || org.serverUrl === organization.serverUrl,
    )
  ) {
    throw new Error('Organization with that name or serverUrl exists!');
  }

  store.set('organizations', [organization, ...store.store.organizations]);
};

export const removeOrganization = (serverUrl: string) =>
  store.set(
    'organizations',
    store.store.organizations.filter(o => o.serverUrl !== serverUrl),
  );
