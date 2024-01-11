import { Router } from 'vue-router';

import useLocalUserStateStore from '../stores/storeLocalUserState';

export function addGuards(router: Router) {
  const localUserStore = useLocalUserStateStore();

  router.beforeEach(to => {
    if (localUserStore.userData?.isInitial && to.name !== 'accountSetup') {
      return {
        name: 'accountSetup',
      };
    }

    if (!to.meta.withoutAuth && !localUserStore.isLoggedIn) {
      router.previousPath = to.path;
      router.push({ name: 'welcome' });
    }

    return true;
  });
}
