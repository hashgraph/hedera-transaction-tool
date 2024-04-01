import { Router } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';
import { isLoggedInOrganization, isOrganizationActive } from '@renderer/utils/userStoreHelpers';

export function addGuards(router: Router) {
  const user = useUserStore();

  router.beforeEach(to => {
    const userIsLoggedIn = user.personal?.isLoggedIn;

    if (
      (isLoggedInOrganization(user.selectedOrganization) && to.name !== 'organizationLogin') ||
      (!isOrganizationActive(user.selectedOrganization) && to.name === 'organizationLogin')
    ) {
      return false;
    }

    if (userIsLoggedIn && user.secretHashes.length === 0 && to.name !== 'accountSetup') {
      return { name: 'accountSetup' };
    }

    if (
      (!userIsLoggedIn && to.name === 'accountSetup') ||
      (userIsLoggedIn && to.name === 'login') ||
      (!isLoggedInOrganization(user.selectedOrganization) && to.name === 'organizationLogin') ||
      (userIsLoggedIn &&
        !user.selectedOrganization &&
        user.secretHashes.length !== 0 &&
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
