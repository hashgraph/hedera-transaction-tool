import { onMounted, ref } from 'vue';

import { defineStore } from 'pinia';

import { IOrganization } from '../../main/shared/interfaces';

import useUserStateStore from './storeUserState';

import * as configService from '../services/configurationService';

const useOrganizationsStore = defineStore('organizations', () => {
  const userStateStore = useUserStateStore();

  /* State */
  const organizations = ref<IOrganization[]>([]);
  const currentOrganization = ref<IOrganization | null>(null);

  /* Actions */
  async function refetch() {
    organizations.value = await configService.getOrganizations();
  }

  function setCurrentOrganization(serverUrl: string) {
    const organization = organizations.value.find(o => o.serverUrl === serverUrl);

    if (organization) {
      currentOrganization.value = organization;
    } else {
      throw Error('Organization not found');
    }
  }

  async function addOrganization(organization: IOrganization) {
    await configService.addOrganization(organization);

    currentOrganization.value = organization;

    refetch();
  }

  async function removeOrganization(serverUrl: string) {
    await configService.removeOrganization(serverUrl);
    refetch();
  }

  onMounted(async () => {
    await refetch();

    if (organizations.value.length > 0 && userStateStore.role === 'organization') {
      currentOrganization.value = organizations.value[0];
    }
  });

  return {
    organizations,
    currentOrganization,
    setCurrentOrganization,
    addOrganization,
    removeOrganization,
    refetch,
  };
});

export default useOrganizationsStore;
