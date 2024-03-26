import { reactive, watch } from 'vue';
import { defineStore } from 'pinia';

import { Organization } from '@prisma/client';
import { getConnectedOrganizations } from '@renderer/services/organizationCredentials';

export interface UserStore {
  isLoggedIn: boolean | null;
  id: string;
  email: string;
  password: string;
  secretHashes: string[];
  activeOrganization: Organization | null;
  connectedOrganizations: Organization[];
}

export const localServerUrl = '';

const useUserStore = defineStore('user', () => {
  /* State */
  const data = reactive<UserStore>({
    isLoggedIn: null,
    id: '',
    email: '',
    password: '',
    secretHashes: [],
    activeOrganization: null,
    connectedOrganizations: [],
  });

  /* Actions */
  function setActiveOrganization(organization: Organization | null) {
    data.activeOrganization = organization;
  }

  function login(id: string, email: string, secretHashes: string[]) {
    data.isLoggedIn = true;
    data.email = email;
    data.id = id && id.length > 0 ? id : '';
    data.secretHashes = secretHashes;
  }

  function logout() {
    data.isLoggedIn = false;
    data.email = '';
    data.id = '';
    data.secretHashes = [];
  }

  async function fetchConnectedOrganizations() {
    if (data.isLoggedIn && data.id.length > 0) {
      data.connectedOrganizations = await getConnectedOrganizations(data.id);
    }
  }

  /* Watchers */
  watch(
    () => data.id,
    async () => {
      await fetchConnectedOrganizations();
    },
  );

  return {
    data,
    setActiveOrganization,
    login,
    logout,
    fetchConnectedOrganizations,
  };
});

export default useUserStore;
