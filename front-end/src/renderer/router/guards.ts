import { Router } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

export function addGuards(router: Router) {
  const user = useUserStore();

  router.beforeEach((to, from) => {
    const userIsLoggedIn = user.personal?.isLoggedIn;
    const userIsLoggedInOrganization = isLoggedInOrganization(user.selectedOrganization);
    const userIsAdmin =
      isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin;

    if (
      (to.meta.onlyAdmin && !userIsAdmin) ||
      (to.meta.onlyOrganization && !userIsLoggedInOrganization)
    ) {
      return { name: 'transactions' };
    }

    if (
      userIsLoggedIn &&
      userIsLoggedInOrganization &&
      user.shouldSetupAccount &&
      to.name !== 'accountSetup'
    ) {
      return { name: 'accountSetup' };
    }

    if (
      (!userIsLoggedIn && to.name === 'accountSetup') ||
      (userIsLoggedIn && to.name === 'login') ||
      (!user.shouldSetupAccount && to.name === 'accountSetup') ||
      (userIsLoggedInOrganization && to.name === 'organizationLogin')
    ) {
      return router.previousPath ? { path: router.previousPath } : { name: 'transactions' };
    }

    if (
      from.name !== 'login' &&
      from.name !== 'organizationLogin' &&
      from.name !== 'accountSetup'
    ) {
      router.previousPath = from.path;
    }

    if (!to.meta.withoutAuth && userIsLoggedIn === false) {
      router.push({ name: 'login' });
    }

    return true;
  });
}
