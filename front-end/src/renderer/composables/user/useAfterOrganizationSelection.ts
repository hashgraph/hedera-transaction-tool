import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import useDefaultOrganization from '@renderer/composables/user/useDefaultOrganization';

import useSetupStores from '@renderer/composables/user/useSetupStores';

import { get as getStoredMnemonics } from '@renderer/services/mnemonicService';

import {
  accountSetupRequired,
  assertUserLoggedIn,
  getLocalKeyPairs,
  isLoggedOutOrganization,
  isOrganizationActive,
  safeAwait,
} from '@renderer/utils';

export default function useAfterOrganizationSelection() {
  /* Stores */
  const user = useUserStore();

  /* Composables */
  const router = useRouter();
  const setupStores = useSetupStores();
  const { set } = useDefaultOrganization();

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

    if (accountSetupRequired(organization, user.keyPairs)) {
      await router.push({ name: 'accountSetup' });
      return;
    }

    const currentRoute = router.currentRoute.value;
    const previousPath = router.previousPath;

    if (previousPath && currentRoute.path !== previousPath) {
      await router.push(previousPath);
    }
  };

  const handleDefaultOrganization = async () => {
    if (isOrganizationActive(user.selectedOrganization)) {
      await set(user.selectedOrganization.id);
    }
  };

  const afterOrganizationSelection = async () => {
    await handleStates();
    await handleNavigation();

    handleDefaultOrganization();

    setupStores();
    user.refetchAccounts();
  };

  return afterOrganizationSelection;
}
