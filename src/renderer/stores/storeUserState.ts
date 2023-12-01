import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';

export interface UserState {
  isLoggedIn: boolean;
  isAdmin?: boolean;
  role?: 'personal' | 'organization';
}

const useUserStateStore = defineStore('userState', () => {
  const userState = reactive<UserState>({
    isLoggedIn: false,
    isAdmin: false,
  });

  const isLoggedIn = computed(() => userState.isLoggedIn);

  return { userState, isLoggedIn };
});

export default useUserStateStore;
