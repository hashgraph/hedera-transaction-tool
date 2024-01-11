import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';
import { ILocalUserData } from 'src/main/shared/interfaces/ILocalUserData';

export interface UserState {
  isLoggedIn: boolean;
  userData: ILocalUserData | null;
}

export const localServerUrl = '';

const useLocalUserStateStore = defineStore('localUserState', () => {
  /* State */
  const userState = reactive<UserState>({
    isLoggedIn: false,
    userData: null,
  });

  /* Getters */
  const isLoggedIn = computed(() => userState.isLoggedIn);
  const userData = computed(() => userState.userData);
  const email = computed(() => userState.userData?.email);

  /* Actions */
  function logUser(userData: ILocalUserData) {
    userState.isLoggedIn = true;
    userState.userData = userData;
  }

  function logoutUser() {
    userState.isLoggedIn = false;
    userState.userData = null;
  }

  return {
    userState,
    isLoggedIn,
    userData,
    email,
    logUser,
    logoutUser,
  };
});

export default useLocalUserStateStore;
