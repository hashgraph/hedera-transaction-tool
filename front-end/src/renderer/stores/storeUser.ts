import { reactive } from 'vue';
import { defineStore } from 'pinia';

export interface UserStore {
  isLoggedIn: boolean;
  id: string;
  email: string;
  password: string;
  secretHashes: string[];
  mode: 'personal' | 'organization';
  accessTokens: string[];
  activeServerURL?: string;
  activeUserId?: string;
}

export const localServerUrl = '';

const useUserStore = defineStore('user', () => {
  /* State */
  const data = reactive<UserStore>({
    isLoggedIn: false,
    id: '',
    email: '',
    password: '',
    secretHashes: [],
    mode: 'personal',
    accessTokens: [],
  });

  /* Actions */
  function setMode(mode: 'personal' | 'organization') {
    data.mode = mode;

    if (mode === 'personal') {
      data.activeServerURL = undefined;
    }
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
    setMode,
    login,
    logout,
  };
});

export default useUserStore;
