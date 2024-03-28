import { reactive, watch } from 'vue';
import { defineStore } from 'pinia';

import { KeyPair, Organization } from '@prisma/client';
import { IUserKey } from '@main/shared/interfaces';

import {
  getConnectedOrganizations,
  getOrganizationsToSignIn,
  shouldSignInOrganization,
} from '@renderer/services/organizationCredentials';
import { ping } from '@renderer/services/organization';

export interface UserStore {
  isLoggedIn: boolean | null;
  id: string;
  email: string;
  password: string;
  secretHashes: string[];
  activeOrganization: Organization | null;
  organizationServerActive: boolean | null;
  connectedOrganizations: Organization[];
  organizationsToSignIn: { credential_id?: string; email?: string; organization: Organization }[];
  isSigningInOrganization: boolean;
  organizationState: {
    passwordTemporary: boolean;
    organizationKeys: IUserKey[];
    secretHashes: string[];
  } | null;
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
    organizationServerActive: null,
    connectedOrganizations: [],
    organizationsToSignIn: [],
    isSigningInOrganization: false,
    organizationState: null,
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
      data.organizationsToSignIn = await getOrganizationsToSignIn(data.id);
    }
  }

  /* Getter */
  const shouldSetupAccount = (localKeyPairs: KeyPair[]) => {
    return (
      (data.activeOrganization &&
        data.organizationState &&
        (data.organizationState.passwordTemporary ||
          data.organizationState.secretHashes.length === 0 ||
          !data.organizationState.organizationKeys
            .filter(k => k.mnemonicHash)
            .every(key =>
              localKeyPairs
                .filter(kp => kp.secret_hash)
                .some(kp => kp.public_key === key.publicKey),
            ))) ||
      data.secretHashes.length === 0
    );
  };

  /* Watchers */
  watch(
    () => data.id,
    async () => {
      await fetchConnectedOrganizations();
    },
  );

  watch(
    () => data.activeOrganization,
    async activeOrganization => {
      if (activeOrganization) {
        const flag = await shouldSignInOrganization(data.id, activeOrganization.id);
        if (
          flag &&
          !data.organizationsToSignIn.find(o => o.organization.id === activeOrganization.id)
        ) {
          data.organizationsToSignIn.push({ organization: activeOrganization });
        }

        data.organizationServerActive = await ping(activeOrganization.serverUrl);
      } else {
        data.organizationServerActive = null;
      }
    },
  );

  return {
    data,
    shouldSetupAccount,
    setActiveOrganization,
    login,
    logout,
    fetchConnectedOrganizations,
  };
});

export default useUserStore;
