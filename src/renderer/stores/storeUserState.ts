import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';

export interface UserState {
  isLoggedIn: boolean;
  isAdmin?: boolean;
  role?: 'personal' | 'organization';
  serverUrl?: string;
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

  /* Actions */
  function setUserRole(role: 'personal' | 'organization') {
    userState.role = role;
  }

  function setServerUrl(url: string | 'local') {
    if (url === 'local') {
      console.log(url);

      userState.serverUrl = localServerUrl;
    } else {
      userState.serverUrl = url;
    }
  }

  function logUser() {
    userState.isLoggedIn = true;
  }

  return { userState, isLoggedIn, isAdmin, serverUrl, role, setUserRole, setServerUrl, logUser };
});

export default useUserStateStore;
