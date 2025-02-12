import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';

import useSetupStores from '@renderer/composables/user/useSetupStores';

import { get as getStoredMnemonics } from '@renderer/services/mnemonicService';
import { getStoredClaim } from '@renderer/services/claimService';

import {
  accountSetupRequired,
  assertUserLoggedIn,
  buildSkipClaimKey,
  getLocalKeyPairs,
  isLoggedInOrganization,
  isLoggedOutOrganization,
  isOrganizationActive,
  isUserLoggedIn,
  safeAwait,
} from '@renderer/utils';

export default function useAfterOrganizationSelection() {
  /* Stores */
  const user = useUserStore();

  /* Composables */
  const router = useRouter();
  const setupStores = useSetupStores();

  /* Functions */
  const handleStates = async () => {
    const organization = user.selectedOrganization;
    assertUserLoggedIn(user.personal);

    const { data: keyPairs } = await safeAwait(getLocalKeyPairs(user.personal, organization));
    const { data: mnemonics } = await safeAwait(
      getStoredMnemonics({ where: { user_id: user.personal.id } }),
    );
    if (!keyPairs || !mnemonics) {
      await user.selectOrganization(null);
      throw new Error('Failed to retrieve key pairs or mnemonics');
    }
    user.keyPairs = keyPairs;
    user.mnemonics = mnemonics;

    if (isLoggedInOrganization(organization)) {
      const claimKey = buildSkipClaimKey(organization.serverUrl, organization.userId);
      const { data } = await safeAwait(getStoredClaim(user.personal.id, claimKey));
      user.skippedSetup = !!data;
    }

    return { keyPairs, mnemonics };
  };

  const handleNavigation = async () => {
    const organization = user.selectedOrganization;
    if (organization !== null && !isOrganizationActive(organization)) {
      await user.selectOrganization(null);
      return;
    }

    if (isLoggedOutOrganization(organization)) {
      await router.push({ name: 'organizationLogin' });
      return;
    }

    if (!isUserLoggedIn(user.personal)) {
      return;
    }

    const shouldSetup = accountSetupRequired(organization, user.keyPairs);
    const shouldNavigateToSetup =
      shouldSetup && (!isLoggedInOrganization(organization) || !user.skippedSetup);

    if (shouldNavigateToSetup) {
      await router.push({ name: 'accountSetup' });
      return;
    }

    const currentRoute = router.currentRoute.value;
    const previousPath = router.previousPath;

    if (previousPath && currentRoute.path !== previousPath) {
      await router.push(previousPath);
    } else if (currentRoute.name === 'login') {
      await router.push({ name: 'transactions' });
    }
  };

  const afterOrganizationSelection = async () => {
    await handleStates();
    await handleNavigation();

    setupStores();
    user.refetchAccounts();
  };

  return afterOrganizationSelection;
}
