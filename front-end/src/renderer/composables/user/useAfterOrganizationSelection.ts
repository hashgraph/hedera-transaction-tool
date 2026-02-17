import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';

import useSetupStores from '@renderer/composables/user/useSetupStores';
import useAccountSetup from '@renderer/stores/storeAccountSetup';
import useDefaultOrganization from '@renderer/composables/user/useDefaultOrganization';

import { get as getStoredMnemonics } from '@renderer/services/mnemonicService';

import {
  assertUserLoggedIn,
  getLocalKeyPairs,
  isLoggedOutOrganization,
  isOrganizationActive,
  isUserLoggedIn,
  safeAwait,
} from '@renderer/utils';

export default function useAfterOrganizationSelection() {
  /* Stores */
  const user = useUserStore();
  const accountSetup = useAccountSetup();

  /* Composables */
  const router = useRouter();
  const setupStores = useSetupStores();
  const { setLast } = useDefaultOrganization();

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
      await setLast(null);
      return;
    }

    if (isLoggedOutOrganization(organization)) {
      await router.push({ name: 'organizationLogin' });
      return;
    }

    if (!isUserLoggedIn(user.personal)) {
      return;
    }

    if (await accountSetup.shouldShowAccountSetup()) {
      await router.push({ name: 'accountSetup' });
      return;
    }

    // only automatically redirect the user to transactions if an account setup is not in progress.
    if (!user.accountSetupStarted) {
      await router.push({ name: 'transactions' });
    }
  };

  const afterOrganizationSelection = async () => {
    await handleStates();
    await handleNavigation();

    await setupStores();
    await user.refetchAccounts();
  };

  return afterOrganizationSelection;
}
