import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';

import { IUserData } from '../../main/shared/interfaces/IUserData';

export interface UserState {
  isLoggedIn: boolean;
  isAdmin?: boolean;
  role?: 'personal' | 'organization';
  serverUrl?: string;
  accessToken?: string;
  userData?: IUserData;
}

export const localServerUrl = '';

const useUserStateStore = defineStore('userState', () => {
  /* State */
  const userState = reactive<UserState>({
    isLoggedIn: false,
    isAdmin: false,
    role: 'personal',
    serverUrl: localServerUrl,
  });

  /* Getters */
  const isLoggedIn = computed(() => userState.isLoggedIn);
  const isAdmin = computed(() => userState.isAdmin);
  const role = computed(() => userState.role);
  const serverUrl = computed(() => userState.serverUrl);
  const accessToken = computed(() => userState.accessToken);
  const userData = computed(() => userState.userData);

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

  function logUser(accessToken: string, userData: IUserData) {
    userState.isLoggedIn = true;
    userState.accessToken = accessToken;
    userState.userData = userData;
  }

  function logoutUser() {
    userState.isLoggedIn = false;
    userState.accessToken = undefined;
    userState.userData = undefined;
  }

  return {
    userState,
    isLoggedIn,
    isAdmin,
    serverUrl,
    role,
    accessToken,
    userData,
    setUserRole,
    setServerUrl,
    logUser,
    logoutUser,
  };
});

export default useUserStateStore;
