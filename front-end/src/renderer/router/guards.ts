import type { _RouterClassic } from 'vue-router';

import { MIGRATE_RECOVERY_PHRASE_HASH } from './constants';

import useUserStore from '@renderer/stores/storeUser';

import { isLoggedInOrganization } from '@renderer/utils';
import useAccountSetupStore from '@renderer/stores/storeAccountSetup.ts';

const excludedPreviousPaths = [
  'login',
  'organizationLogin',
  'accountSetup',
  'migrate',
  'index',
  MIGRATE_RECOVERY_PHRASE_HASH,
];

export function addGuards(router: _RouterClassic) {
  const user = useUserStore();
  const setupAccount = useAccountSetupStore();
  const xRouter = router as _RouterClassic & Record<string, string>;

  router.beforeEach(async (to, from) => {
    const userIsLoggedIn = user.personal?.isLoggedIn;
    const userIsLoggedInOrganization = isLoggedInOrganization(user.selectedOrganization);
    const userIsAdmin =
      isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin;
    const showAccountSetup = await setupAccount.shouldShowAccountSetup();

    if (user.accountSetupStarted) {
      return to.name === 'accountSetup';
    }

    if (
      (to.meta.onlyAdmin && !userIsAdmin) ||
      (to.meta.onlyOrganization && !userIsLoggedInOrganization)
    ) {
      return { name: 'transactions' };
    }

    if (
      userIsLoggedIn &&
      (user.selectedOrganization ? userIsLoggedInOrganization : true) &&
      showAccountSetup &&
      to.name !== 'accountSetup'
    ) {
      return { name: 'accountSetup' };
    }

    if (
      (!userIsLoggedIn && to.name === 'accountSetup') ||
      (userIsLoggedIn && to.name === 'login') ||
      (!showAccountSetup && to.name === 'accountSetup') ||
      (userIsLoggedInOrganization && to.name === 'organizationLogin') ||
      (userIsLoggedIn && to.name === 'migrate')
    ) {
      return xRouter.previousPath ? { path: xRouter.previousPath } : { name: 'transactions' };
    }

    if (!excludedPreviousPaths.includes(from.name?.toString() || '')) {
      xRouter.previousPath = from.path;
    }

    if (from.name === 'transactions') {
      xRouter.previousTab = from.query.tab as string;
    }

    if (!to.meta.withoutAuth && userIsLoggedIn === false) {
      return { name: 'login' };
    }

    return true;
  });
}
