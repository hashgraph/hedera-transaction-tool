import { Router } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

export function addGuards(router: Router) {
  const user = useUserStore();

  router.beforeEach(to => {
    const userIsLoggedIn = user.data.isLoggedIn;

    if (userIsLoggedIn && user.data.secretHashes.length === 0 && to.name !== 'accountSetup') {
      return {
        name: 'accountSetup',
      };
    }

    if (userIsLoggedIn && to.name === 'login') {
      return router.previousPath ? { path: router.previousPath } : { name: 'transactions' };
    }

    if (to.name !== 'login') {
      router.previousPath = to.path;
    }

    if (!to.meta.withoutAuth && userIsLoggedIn === false) {
      router.push({ name: 'login' });
    }

    return true;
  });
}
