import { Router } from 'vue-router';
import useUserStateStore from '../stores/storeUserState';

export function addGuards(router: Router) {
  const userStateStore = useUserStateStore();

  router.beforeEach(to => {
    if (userStateStore.isInitialLogin && to.name !== 'accountSetup') {
      return {
        name: 'accountSetup',
      };
    }

    if (!to.meta.withoutAuth && !userStateStore.isLoggedIn) {
      return {
        name: 'welcome',
      };
    }
  });
}
