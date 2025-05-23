import type { Router } from 'vue-router';

import { MIGRATE_RECOVERY_PHRASE_HASH } from './constants';

import useUserStore from '@renderer/stores/storeUser';

import { isLoggedInOrganization } from '@renderer/utils';

const excludedPreviousPaths = [
  'login',
  'organizationLogin',
  'accountSetup',
  'migrate',
  'index',
  MIGRATE_RECOVERY_PHRASE_HASH,
];

export function addGuards(router: Router) {
  const user = useUserStore();

  router.beforeEach(to => {
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
      (user.selectedOrganization ? userIsLoggedInOrganization : true) &&
      user.shouldSetupAccount &&
      !user.skippedSetup &&
      to.name !== 'accountSetup'
    ) {
      return { name: 'accountSetup' };
    }

    if (
      (!userIsLoggedIn && to.name === 'accountSetup') ||
      (userIsLoggedIn && to.name === 'login') ||
      (!user.shouldSetupAccount && to.name === 'accountSetup') ||
      (userIsLoggedInOrganization && to.name === 'organizationLogin') ||
      (userIsLoggedIn && to.name === 'migrate')
    ) {
      return router.previousPath ? { path: router.previousPath } : { name: 'transactions' };
    }

    if (!excludedPreviousPaths.includes(to.name?.toString() || '')) {
      router.previousPath = to.path;
    }

    if (!to.meta.withoutAuth && userIsLoggedIn === false) {
      router.push({ name: 'login' });
    }

    return true;
  });
}
