import { onMounted, ref } from 'vue';

import { defineStore } from 'pinia';

import { Organization } from '../../main/modules/store';

import * as configService from '../services/configurationService';

const useOrganizationsStore = defineStore('organizations', () => {
  const organizations = ref<Organization[]>([]);

  async function refetch() {
    organizations.value = await configService.getOrganizations();
  }

  onMounted(async () => {
    refetch();
  });

  async function addOrganization(organization: Organization) {
    await configService.addOrganization(organization);
    refetch();
  }

  async function removeOrganization(serverUrl: string) {
    await configService.removeOrganization(serverUrl);
    refetch();
  }

  return { organizations, addOrganization, removeOrganization, refetch };
});

export default useOrganizationsStore;
