import { Router } from 'vue-router';

import useUserStore from '../stores/storeUser';

export function addGuards(router: Router) {
  const user = useUserStore();

  router.beforeEach(to => {
    if (user.data.isLoggedIn && user.data.secretHashes.length === 0 && to.name !== 'accountSetup') {
      return {
        name: 'accountSetup',
      };
    }

    if (user.data.isLoggedIn && to.name === 'welcome') {
      return { name: 'settingsKeys' };
    }

    if (!to.meta.withoutAuth && !user.data.isLoggedIn) {
      router.previousPath = to.path;
      router.push({ name: 'welcome' });
    }

    return true;
  });
}
