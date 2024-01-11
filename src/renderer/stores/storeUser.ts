import { reactive } from 'vue';
import { defineStore } from 'pinia';

export interface User {
  isLoggedIn: boolean;
  email: string;
  password: string;
  secretHashes: string[];
  mode: 'personal' | 'organization';
  accessTokens: string[];
  activeServerURL: string | null;
  activeUserId: string | null;
}

export const localServerUrl = '';

const useUserStore = defineStore('user', () => {
  /* State */
  const data = reactive<User>({
    isLoggedIn: false,
    email: '',
    password: '',
    secretHashes: [],
    mode: 'personal',
    accessTokens: [],
    activeServerURL: null,
    activeUserId: null,
  });

  /* Actions */
  function setMode(mode: 'personal' | 'organization') {
    data.mode = mode;

    if (mode === 'personal') {
      data.activeServerURL = null;
    }
  }

  function login(email: string, secretHashes: string[]) {
    data.isLoggedIn = true;
    data.email = email;
    data.secretHashes = secretHashes;
  }

  function logout() {
    data.isLoggedIn = false;
    data.email = '';
    data.secretHashes = [];
  }
  return {
    data,
    setMode,
    login,
    logout,
  };
});

export default useUserStore;
