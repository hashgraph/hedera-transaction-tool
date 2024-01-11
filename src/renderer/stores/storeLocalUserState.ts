import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';
import { ILocalUserData } from 'src/main/shared/interfaces/ILocalUserData';

export interface UserState {
  isLoggedIn: boolean;
  secretHashes: string[];
  userData: ILocalUserData | null;
}

export const localServerUrl = '';

const useLocalUserStateStore = defineStore('localUserState', () => {
  /* State */
  const userState = reactive<UserState>({
    isLoggedIn: false,
    userData: null,
    secretHashes: [],
  });

  /* Getters */
  const isLoggedIn = computed(() => userState.isLoggedIn);
  const userData = computed(() => userState.userData);
  const email = computed(() => userState.userData?.email);
  const secretHashes = computed(() => userState.secretHashes);

  /* Actions */
  function logUser(userData: ILocalUserData) {
    userState.isLoggedIn = true;
    userState.userData = userData;
  }

  function logoutUser() {
    userState.isLoggedIn = false;
    userState.userData = null;
  }

  function setSecretHashes(hashes: string[]) {
    userState.secretHashes = hashes;
  }

  return {
    userState,
    isLoggedIn,
    userData,
    email,
    secretHashes,
    logUser,
    logoutUser,
    setSecretHashes,
  };
});

export default useLocalUserStateStore;
