import { reactive } from 'vue';
import { defineStore } from 'pinia';

import { Organization } from '@prisma/client';

export interface UserStore {
  isLoggedIn: boolean | null;
  id: string;
  email: string;
  password: string;
  secretHashes: string[];
  activeOrganization: Organization | null;
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
  return {
    data,
    setActiveOrganization,
    login,
    logout,
  };
});

export default useUserStore;
