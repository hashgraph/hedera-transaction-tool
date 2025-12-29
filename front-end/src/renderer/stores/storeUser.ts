import type { KeyPair, Mnemonic, Organization, PublicKeyMapping } from '@prisma/client';

import type {
  PersonalUser,
  PublicKeyAccounts,
  RecoveryPhrase,
  ConnectedOrganization,
  OrganizationTokens,
} from '@renderer/types';

import { computed, ref, watch, nextTick, watchEffect } from 'vue';
import { defineStore } from 'pinia';

import { Prisma } from '@prisma/client';

import { ACCOUNT_SETUP_STARTED } from '@shared/constants';

import { add, remove } from '@renderer/services/claimService';

import useAfterOrganizationSelection from '@renderer/composables/user/useAfterOrganizationSelection';
import useVersionCheck from '@renderer/composables/useVersionCheck';

import { safeAwait } from '@renderer/utils';
import * as ush from '@renderer/utils/userStoreHelpers';

import useNetworkStore from './storeNetwork';
import useOrganizationConnection from './storeOrganizationConnection';
import { AccountByPublicKeyCache } from '@renderer/caches/mirrorNode/AccountByPublicKeyCache.ts';
import { useToast } from 'vue-toast-notification';
import { warningToastOptions } from '@renderer/utils/toastOptions';

const useUserStore = defineStore('user', () => {
  /* Stores */
  const network = useNetworkStore();
  const orgConnection = useOrganizationConnection();
  const toast = useToast();

  /* Composables */
  const afterOrganizationSelection = useAfterOrganizationSelection();
  const { reset: resetVersionCheck } = useVersionCheck();

  /* Injected */
  const accountByKeyCache = AccountByPublicKeyCache.inject();

  /* State */
  /** Keys */
  const publicKeyToAccounts = ref<PublicKeyAccounts[]>([]);
  const recoveryPhrase = ref<RecoveryPhrase | null>(null);
  const keyPairs = ref<KeyPair[]>([]);
  const mnemonics = ref<Mnemonic[]>([]);
  const publicKeyMappings = ref<PublicKeyMapping[]>([]);

  /** Personal */
  const personal = ref<PersonalUser | null>(null);
  const passwordStoreDuration = ref<number>(10 * 60 * 1_000);

  /** Organization */
  const selectedOrganization = ref<ConnectedOrganization | null>(null);
  const organizations = ref<ConnectedOrganization[]>([]);
  const organizationTokens = ref<OrganizationTokens>({});
  const skippedSetup = ref<boolean>(false);

  /** AccountSetup */
  const accountSetupStarted = ref<boolean | null>(null);

  /* Computed */
  /** Keys */
  const secretHashes = computed<string[]>(() => ush.getSecretHashesFromKeys(keyPairs.value));
  const publicKeys = computed(() => keyPairs.value.map(kp => kp.public_key));
  const publicKeysToAccountsFlattened = computed(() =>
    ush.flattenAccountIds(publicKeyToAccounts.value),
  );
  const shouldSetupAccount = computed(() =>
    ush.accountSetupRequired(selectedOrganization.value, keyPairs.value),
  );

  /* Actions */
  /** Personal */
  const login = async (id: string, email: string, useKeychain: boolean) => {
    personal.value = ush.createPersonalUser(id, email, useKeychain);
    await ush.setupSafeNetwork(id, network.setup);
    await selectOrganization(null);
  };

  const logout = () => {
    personal.value = ush.createPersonalUser();
    selectedOrganization.value = null;
    organizations.value = [];
    publicKeyToAccounts.value = [];
    keyPairs.value = [];
    recoveryPhrase.value = null;
    resetVersionCheck();
  };

  const getPassword = () => {
    if (!ush.isUserLoggedIn(personal.value)) throw new Error('User is not logged in');
    if (!ush.isLoggedInWithValidPassword(personal.value)) {
      personal.value.password = null;
      return null;
    }

    personal.value.passwordExpiresAt = new Date(Date.now() + passwordStoreDuration.value);
    return personal.value.password;
  };

  const setPassword = (password: string) => {
    if (!ush.isUserLoggedIn(personal.value)) throw new Error('User is not logged in');

    personal.value.password = password;

    if (!ush.isLoggedInWithPassword(personal.value)) throw new Error('Failed to set user password');

    personal.value.passwordExpiresAt = new Date(Date.now() + passwordStoreDuration.value);
  };

  const setPasswordStoreDuration = (durationMs: number) => {
    if (!ush.isUserLoggedIn(personal.value)) throw new Error('User is not logged in');

    const oldDuration = passwordStoreDuration.value;
    passwordStoreDuration.value = durationMs;

    if (ush.isLoggedInWithPassword(personal.value)) {
      const prevSetAt = personal.value.passwordExpiresAt.getTime() - oldDuration;
      personal.value.passwordExpiresAt = new Date(prevSetAt + durationMs);
    }
  };

  /** Keys */
  const setRecoveryPhrase = async (words: string[] | null) => {
    if (words === null) {
      recoveryPhrase.value = null;
    } else {
      recoveryPhrase.value = await ush.createRecoveryPhrase(words);
    }
  };

  const refetchAccounts = async () => {
    publicKeyToAccounts.value = [];
    publicKeyToAccounts.value = await ush.getPublicKeyToAccounts(
      publicKeyToAccounts.value,
      keyPairs.value,
      network.mirrorNodeBaseURL,
      accountByKeyCache,
    );
  };

  const refetchKeys = async () => {
    keyPairs.value = await ush.getLocalKeyPairs(personal.value, selectedOrganization.value);
  };

  const refetchPublicKeys = async () => {
    publicKeyMappings.value = await ush.getAllPublicKeyMappings();
  };

  const refetchMnemonics = async () => {
    mnemonics.value = await ush.getMnemonics(personal.value);
  };

  const storeKey = async (
    keyPair: Prisma.KeyPairUncheckedCreateInput,
    mnemonic: string[] | string | null,
    password: string | null,
    encrypted: boolean,
  ) => {
    await ush.storeKeyPair(keyPair, mnemonic, password, encrypted);
    await refetchKeys();
    await refetchAccounts();
  };

  const storePublicKeyMapping = async (publicKey: string, nickname: string) => {
    await ush.addPublicKeyMapping(publicKey, nickname);
    await refetchPublicKeys();
  };

  const updatePublicKeyMappingNickname = async (
    id: string,
    publicKey: string,
    newNickname: string,
  ) => {
    await ush.updatePublicKeyNickname(id, publicKey, newNickname);
    await refetchPublicKeys();
  };

  const deletePublicKeyMapping = async (id: string) => {
    await ush.deletePublicKeyMapping(id);
    await refetchPublicKeys();
  };

  /* Organization */
  const selectOrganization = async (organization: Organization | null) => {
    await nextTick();

    if (organization) {
      const connectionStatus = orgConnection.getConnectionStatus(organization.serverUrl);
      const disconnectReason = orgConnection.getDisconnectReason(organization.serverUrl);

      // Prevent selecting organizations that are disconnected due to upgrade requirement
      if (connectionStatus === 'disconnected' && disconnectReason === 'upgradeRequired') {
        const orgName = organization.nickname || organization.serverUrl;
        console.warn(
          `[${new Date().toISOString()}] Cannot select disconnected organization: ${orgName} (Reason: ${disconnectReason})`,
        );

        toast.info(
          `Cannot select disconnected organization: "${orgName}". An organization update is required.`,
          warningToastOptions,
        );
        // Auto-switch to another connected organization or personal mode
        const connectedOrg = organizations.value.find(
          org =>
            org.serverUrl !== organization.serverUrl &&
            orgConnection.isConnected(org.serverUrl),
        );

        if (connectedOrg) {
          console.log(
            `[${new Date().toISOString()}] Auto-switching to connected organization: ${connectedOrg.nickname || connectedOrg.serverUrl}`,
          );
          selectedOrganization.value = await ush.getConnectedOrganization(connectedOrg, personal.value);
          await afterOrganizationSelection();
          return;
        } else {
          // No connected organizations available, switch to personal mode
          console.log(
            `[${new Date().toISOString()}] No connected organizations available, switching to personal mode`,
          );
          selectedOrganization.value = null;
          await afterOrganizationSelection();
          return;
        }
      }
    }

    // Check if currently selected organization becomes disconnected
    if (selectedOrganization.value && organization?.serverUrl !== selectedOrganization.value.serverUrl) {
      const currentStatus = orgConnection.getConnectionStatus(selectedOrganization.value.serverUrl);
      const currentReason = orgConnection.getDisconnectReason(selectedOrganization.value.serverUrl);

      if (currentStatus === 'disconnected' && currentReason === 'upgradeRequired') {
        console.log(
          `[${new Date().toISOString()}] Current organization disconnected, auto-switching`,
        );
        // Organization was disconnected, switch to the new one or personal mode
        selectedOrganization.value = await ush.getConnectedOrganization(organization, personal.value);
        await afterOrganizationSelection();
        return;
      }
    }

    selectedOrganization.value = await ush.getConnectedOrganization(organization, personal.value);
    await afterOrganizationSelection();
  };

  const refetchUserState = async () =>
    (selectedOrganization.value = await ush.refetchUserState(selectedOrganization.value));

  const refetchOrganizationTokens = async () => {
    organizationTokens.value = await ush.getOrganizationJwtTokens(personal.value);
    ush.setSessionStorageTokens(organizations.value, organizationTokens.value);
  };

  const refetchOrganizations = async () => {
    await ush.updateConnectedOrganizations(organizations, personal.value);
    await refetchOrganizationTokens();
  };

  const deleteOrganization = async (organizationId: string) => {
    organizations.value = organizations.value.filter(org => org.id !== organizationId);
    await ush.deleteOrganizationConnection(organizationId, personal.value);
  };

  const getJwtToken = (organizationId?: string): string | null => {
    return organizationTokens.value[organizationId || selectedOrganization.value?.id || ''] || null;
  };

  /* AccountSetup */
  const setAccountSetupStarted = (value: boolean) => {
    accountSetupStarted.value = value;
  };

  /* Watchers */
  watch(
    () => network.network,
    () => {
      refetchAccounts();
    },
  );

  watchEffect(async () => {
    const userId = personal.value && 'id' in personal.value ? personal.value.id : undefined;
    const setupStarted = accountSetupStarted.value;
    if (userId) {
      if (setupStarted) {
        await safeAwait(add(userId, ACCOUNT_SETUP_STARTED, 'true'));
      } else {
        await safeAwait(remove(userId, [ACCOUNT_SETUP_STARTED]));
      }
    }
  });

  /* Exports */
  const exports = {
    keyPairs,
    publicKeyToAccounts,
    publicKeysToAccountsFlattened,
    recoveryPhrase,
    personal,
    selectedOrganization,
    organizations,
    secretHashes,
    publicKeys,
    shouldSetupAccount,
    accountSetupStarted,
    mnemonics,
    skippedSetup,
    deleteOrganization,
    getJwtToken,
    getPassword,
    login,
    logout,
    refetchAccounts,
    refetchKeys,
    refetchMnemonics,
    refetchOrganizations,
    refetchOrganizationTokens,
    refetchUserState,
    selectOrganization,
    setAccountSetupStarted,
    setPassword,
    setPasswordStoreDuration,
    setRecoveryPhrase,
    storeKey,
    storePublicKeyMapping,
    publicKeyMappings,
    refetchPublicKeys,
    updatePublicKeyMappingNickname,
    deletePublicKeyMapping,
  };

  return exports;
});

export default useUserStore;
