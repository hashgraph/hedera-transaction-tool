import { IOrganization } from '@main/shared/interfaces';
import getStore from '@main/modules/store';

const store = getStore();

/* Clear Store */
export const clearStore = () => store.clear();

/* Organizations */
export const getOrganizations = () => {
  try {
    return store.get('organizations');
  } catch (error) {
    throw new Error('Failed to fetch stored organizations');
  }
};

export const addOrganization = (organization: IOrganization) => {
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
