import { onMounted, ref } from 'vue';

import { defineStore } from 'pinia';

import { Organization } from '../../main/modules/store';

import * as configService from '../services/configurationService';

const useOrganizationsStore = defineStore('organizations', () => {
  /* State */
  const organizations = ref<Organization[]>([]);
  const currentOrganization = ref<Organization | null>(null);

  /* Actions */
  async function refetch() {
    organizations.value = await configService.getOrganizations();
  }

  async function addOrganization(organization: Organization) {
    await configService.addOrganization(organization);
    refetch();
  }

  async function removeOrganization(serverUrl: string) {
    await configService.removeOrganization(serverUrl);
    refetch();
  }

  onMounted(async () => {
    await refetch();

    if (organizations.value.length > 0) {
      currentOrganization.value = organizations.value[0];
    }
  });

  return { organizations, currentOrganization, addOrganization, removeOrganization, refetch };
});

export default useOrganizationsStore;
