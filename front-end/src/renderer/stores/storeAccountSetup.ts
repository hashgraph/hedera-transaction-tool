import { defineStore } from 'pinia';
import useUserStore from '@renderer/stores/storeUser.ts';
import { computed } from 'vue';
import { SKIPPED_ORGANIZATION_SETUP, SKIPPED_PERSONAL_SETUP } from '@shared/constants';
import { getSecretHashesFromKeys, isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';
import { getStoredClaim, setStoredClaim } from '@renderer/services/claimService.ts';

export interface StoreAccountSetup {
  shouldShowAccountSetup: () => Promise<boolean>;
  passwordChangeRequired: () => Promise<boolean>;
  recoveryPhraseRequired: () => Promise<boolean>;
  handleSkipRecoveryPhrase: () => Promise<void>;
}

const useAccountSetupStore = defineStore('accountSetupStore', (): StoreAccountSetup => {
  /* Stores */
  const user = useUserStore();

  /* Computed */
  const skipClaimKey = computed(() => {
    let result: string | null;
    const organization = user.selectedOrganization;
    if (organization) {
      if (isLoggedInOrganization(organization)) {
        result = `${organization.serverUrl}${organization.userId}${SKIPPED_ORGANIZATION_SETUP}`;
      } else {
        result = null;
      }
    } else {
      result = SKIPPED_PERSONAL_SETUP;
    }
    return result;
  });

  /* Actions */
  const passwordChangeRequired = async (): Promise<boolean> => {
    let result: boolean;
    if (isLoggedInOrganization(user.selectedOrganization)) {
      result = user.selectedOrganization.isPasswordTemporary;
    } else {
      result = false;
    }
    return result;
  };

  const recoveryPhraseRequired = async (): Promise<boolean> => {
    let result: boolean;
    if (await shouldSkipSetup()) {
      result = false;
    } else if (isLoggedInOrganization(user.selectedOrganization)) {
      result = user.selectedOrganization.secretHashes.length === 0;
    } else {
      result = getSecretHashesFromKeys(user.keyPairs).length === 0;
    }
    return result;
  };

  const shouldShowAccountSetup = async () => {
    return (await passwordChangeRequired()) || (await recoveryPhraseRequired());
  };

  const handleSkipRecoveryPhrase = async () => {
    if (isUserLoggedIn(user.personal) && skipClaimKey.value !== null) {
      await setStoredClaim(user.personal.id, skipClaimKey.value, 'true');
    }
    user.setAccountSetupStarted(false);
  };

  /* Functions */
  const shouldSkipSetup = async () => {
    let result: boolean;
    if (skipClaimKey.value !== null) {
      const userId = isUserLoggedIn(user.personal) ? user.personal.id : undefined;
      try {
        const value = await getStoredClaim(userId, skipClaimKey.value);
        result = value === 'true';
      } catch (reason) {
        console.error(reason);
        result = false;
      }
    } else {
      result = false;
    }
    return result;
  };


  return {
    shouldShowAccountSetup,
    passwordChangeRequired,
    recoveryPhraseRequired,
    handleSkipRecoveryPhrase,
  };
});

export default useAccountSetupStore;
