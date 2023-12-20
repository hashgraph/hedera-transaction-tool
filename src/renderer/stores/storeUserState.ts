import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';

import { IUserData } from '../../main/shared/interfaces/IUserData';

export interface UserState {
  isLoggedIn: boolean;
  isInitialLogin: boolean;
  isAdmin?: boolean;
  role?: 'personal' | 'organization';
  serverUrl?: string;
  accessToken?: string;
  userData?: IUserData;
  secretHashes?: string[];
}

export const localServerUrl = '';

const useUserStateStore = defineStore('userState', () => {
  /* State */
  const userState = reactive<UserState>({
    isLoggedIn: false,
    isInitialLogin: false,
    isAdmin: false,
    role: 'personal',
    serverUrl: localServerUrl,
  });

  /* Getters */
  const isLoggedIn = computed(() => userState.isLoggedIn);
  const isInitialLogin = computed(() => userState.isInitialLogin);
  const isAdmin = computed(() => userState.isAdmin);
  const role = computed(() => userState.role);
  const serverUrl = computed(() => userState.serverUrl);
  const accessToken = computed(() => userState.accessToken);
  const userData = computed(() => userState.userData);
  const secretHashes = computed(() => userState.secretHashes);

  /* Actions */

  function setUserRole(role: 'personal' | 'organization') {
    userState.role = role;

    if (role === 'personal') {
      setServerUrl('local');
    }
  }

  function setServerUrl(url: string | 'local') {
    if (url === 'local') {
      userState.serverUrl = localServerUrl;
    } else {
      userState.serverUrl = url;
    }
  }

  function setSecretHashes(hashes?: string[]) {
    userState.secretHashes = hashes;
  }

  function logUser(accessToken: string, userData: IUserData, isInitialLogin: boolean) {
    userState.isLoggedIn = true;
    userState.accessToken = accessToken;
    userState.userData = userData;
    userState.isInitialLogin = isInitialLogin;
  }

  function logoutUser() {
    userState.isLoggedIn = false;
    userState.accessToken = undefined;
    userState.userData = undefined;
    userState.isInitialLogin = false;
  }

  function setIsInitialLogin(isInitial: boolean) {
    userState.isInitialLogin = isInitial;
  }

  return {
    userState,
    isLoggedIn,
    isInitialLogin,
    isAdmin,
    serverUrl,
    role,
    accessToken,
    userData,
    secretHashes,
    setUserRole,
    setSecretHashes,
    setServerUrl,
    setIsInitialLogin,
    logUser,
    logoutUser,
  };
});

export default useUserStateStore;
