import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';
import useNotificationsStore from '@renderer/stores/storeNotifications';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';

import { get as getStoredMnemonics } from '@renderer/services/mnemonicService';

import {
  accountSetupRequired,
  assertUserLoggedIn,
  getLocalKeyPairs,
  isLoggedOutOrganization,
  isOrganizationActive,
  navigateToPreviousRoute,
  safeAwait,
} from '@renderer/utils';

export default function useAfterOrganizationSelection() {
  /* Stores */
  const user = useUserStore();
  const contacts = useContactsStore();
  const notifications = useNotificationsStore();
  const ws = useWebsocketConnection();

  /* Composables */
  const router = useRouter();
  const toast = useToast();

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

  const setupStores = async () => {
    const results = await Promise.allSettled([contacts.fetch(), notifications.setup(), ws.setup()]);
    results.forEach(r => r.status === 'rejected' && toast.error(r.reason));
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

    navigateToPreviousRoute(router);
  };

  const afterOrganizationSelection = async () => {
    await handleStates();
    await handleNavigation();

    setupStores();
    user.refetchAccounts();
  };

  return afterOrganizationSelection;
}
