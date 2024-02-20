import {onMounted, ref} from 'vue';
import {defineStore} from 'pinia';

import type {IOrganization} from '../../../../types/interfaces';

import * as configService from '@renderer/services/configurationService';

const useOrganizationsStore = defineStore('organizations', () => {
  /* State */
  const organizations = ref<IOrganization[]>([]);

  /* Actions */
  async function refetch() {
    organizations.value = await configService.getOrganizations();
  }

  async function addOrganization(organization: IOrganization) {
    await configService.addOrganization(organization);
    await refetch();
  }

  async function removeOrganization(serverUrl: string) {
    await configService.removeOrganization(serverUrl);
    await refetch();
  }

  /* Hooks */
  onMounted(async () => {
    await refetch();
  });

  return {
    organizations,
    addOrganization,
    removeOrganization,
    refetch,
  };
});

export default useOrganizationsStore;
