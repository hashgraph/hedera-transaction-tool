import { Router } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

export function addGuards(router: Router) {
  const user = useUserStore();

  router.beforeEach(to => {
    const userIsLoggedIn = user.data.isLoggedIn;
    const userIsSigningInOrganization = user.data.isSigningInOrganization;
    const organizationServerActive = user.data.organizationServerActive;

    if (
      (userIsSigningInOrganization && to.name !== 'organizationLogin') ||
      (!organizationServerActive && to.name === 'organizationLogin')
    ) {
      return false;
    }

    if (
      userIsLoggedIn &&
      !userIsSigningInOrganization &&
      user.data.secretHashes.length === 0 &&
      to.name !== 'accountSetup'
    ) {
      return {
        name: 'accountSetup',
      };
    }

    if (
      (!userIsLoggedIn && to.name === 'accountSetup') ||
      (userIsLoggedIn && to.name === 'login') ||
      (!userIsSigningInOrganization && to.name === 'organizationLogin') ||
      (userIsLoggedIn &&
        !user.data.activeOrganization &&
        user.data.secretHashes.length !== 0 &&
        to.name === 'accountSetup')
    ) {
      return router.previousPath ? { path: router.previousPath } : { name: 'transactions' };
    }

    if (to.name !== 'login' && to.name !== 'organizationLogin' && to.name !== 'accountSetup') {
      router.previousPath = to.path;
    }

    if (!to.meta.withoutAuth && userIsLoggedIn === false) {
      router.push({ name: 'login' });
    }

    return true;
  });
}
