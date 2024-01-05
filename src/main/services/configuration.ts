import getStore, { Organization } from '../modules/store';

const store = getStore();

/* Clear Store */
export const clearStore = () => store.clear();

/* Organizations */
export const getOrganizations = () => store.get('organizations');

export const addOrganization = (organization: Organization) => {
  if (
    store.store.organizations.some(
      org => org.name === organization.name || org.serverUrl === organization.serverUrl,
    )
  ) {
    throw new Error('Organization with that Name or Server URL exists!');
  }

  store.set('organizations', [organization, ...store.store.organizations]);
};

export const removeOrganization = (serverUrl: string) =>
  store.set(
    'organizations',
    store.store.organizations.filter(o => o.serverUrl !== serverUrl),
  );
