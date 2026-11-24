import type { KeyPair, Mnemonic, Organization, PublicKeyMapping } from '@prisma/client';

import type {
  PersonalUser,
  PublicKeyAccounts,
  RecoveryPhrase,
  ConnectedOrganization,
  OrganizationTokens,
} from '@renderer/types';

import { computed, ref, watch, nextTick, watchEffect, type Ref } from 'vue';
import { defineStore } from 'pinia';

import { Prisma } from '@prisma/client';

import { ACCOUNT_SETUP_STARTED, SELECTED_NETWORK } from '@shared/constants';

import { add, getStoredClaim, remove } from '@renderer/services/claimService';

import useAfterOrganizationSelection from '@renderer/composables/user/useAfterOrganizationSelection';
import useVersionCheck from '@renderer/composables/useVersionCheck';

import { safeAwait } from '@renderer/utils';
import * as pks from '@renderer/services/publicKeyMappingService';
import * as ush from '@renderer/utils/userStoreHelpers';
import { createLogger } from '@renderer/utils/logger';
import { getVersionStatusForOrg, resetVersionStatusForOrg } from './versionState';

import useNetworkStore from './storeNetwork';
import useOrganizationConnection from './storeOrganizationConnection';
import { AppCache } from '@renderer/caches/AppCache';
import { reconnectOrganization } from '@renderer/services/organization';

const logger = createLogger('renderer.store.user');

const useUserStore = defineStore('user', () => {
  /* Stores */
  const network = useNetworkStore();
  const orgConnection = useOrganizationConnection();

  /* Composables */
  const afterOrganizationSelection = useAfterOrganizationSelection();
  const { reset: resetVersionCheck } = useVersionCheck();

  /* Injected */
  const accountByKeyCache = AppCache.inject().mirrorAccountByPublicKey;

  /* State */
  /** Keys */
  const publicKeyToAccounts = ref<PublicKeyAccounts[]>([]);
  const isLoadingAccounts = ref(false);
  const loadingAccountKeys = ref<string[]>([]);
  let accountsRefetchId = 0;
  const recoveryPhrase: Ref<RecoveryPhrase|null> = ref(null);
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

  /** AccountSetup */
  const accountSetupStarted = ref<boolean | null>(null);

  /* Computed */
  /** Keys */
  const secretHashes = computed<string[]>(() => ush.getSecretHashesFromKeys(keyPairs.value));
  const publicKeys = computed(() => keyPairs.value.map(kp => kp.public_key));
  const publicKeysToAccountsFlattened = computed(() =>
    ush.flattenAccountIds(publicKeyToAccounts.value),
  );

  /* Actions */
  /** Personal */
  const login = async (id: string, email: string, useKeychain: boolean) => {
    personal.value = {
      isLoggedIn: true,
      id,
      email,
      password: null,
      useKeychain: useKeychain,
    };
    const { data } = await safeAwait(getStoredClaim(id, SELECTED_NETWORK));
    await safeAwait(network.setup(data));
    await selectOrganization(null);
  };

  const logout = () => {
    personal.value = {
      isLoggedIn: false,
    };
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

  /**
   * Reloads the accounts of every key, or only those of `publicKey` when given
   * (the other keys' accounts are left as they are).
   */
  const refetchAccounts = async (publicKey?: string) => {
    if (publicKey !== undefined) {
      await refetchAccountsOfKey(publicKey);
      return;
    }

    // Only the latest refetch may publish its result, as refetches can overlap
    const refetchId = ++accountsRefetchId;
    isLoadingAccounts.value = true;
    publicKeyToAccounts.value = [];

    try {
      const result = await ush.getPublicKeyToAccounts(
        [],
        keyPairs.value,
        network.mirrorNodeBaseURL,
        accountByKeyCache,
      );
      if (refetchId === accountsRefetchId) {
        publicKeyToAccounts.value = result;
      }
    } finally {
      if (refetchId === accountsRefetchId) {
        isLoadingAccounts.value = false;
      }
    }
  };

  const refetchAccountsOfKey = async (publicKey: string) => {
    loadingAccountKeys.value.push(publicKey);

    try {
      const [entry] = await ush.getPublicKeyToAccounts(
        [],
        keyPairs.value.filter(kp => kp.public_key === publicKey),
        network.mirrorNodeBaseURL,
        accountByKeyCache,
      );
      publicKeyToAccounts.value = [
        ...publicKeyToAccounts.value.filter(pkToAcc => pkToAcc.publicKey !== publicKey),
        ...(entry ? [entry] : []),
      ];
    } finally {
      const index = loadingAccountKeys.value.indexOf(publicKey);
      if (index !== -1) loadingAccountKeys.value.splice(index, 1);
    }
  };

  const isLoadingAccountsOf = (publicKey: string) =>
    isLoadingAccounts.value || loadingAccountKeys.value.includes(publicKey);

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
    // Not awaited: it queries the mirror node and would keep callers waiting. Only the new key's
    // accounts are fetched; isLoadingAccountsOf tells consumers that they are still loading.
    safeAwait(refetchAccounts(keyPair.public_key)).then(({ error }) => {
      if (error) {
        logger.error('Failed to refetch the accounts of the stored key', {
          publicKey: keyPair.public_key,
          error,
        });
      }
    });
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
    await pks.deletePublicKey(id);
    await refetchPublicKeys();
  };

  /* Organization */
  const selectOrganization = async (organization: Organization | null) => {
    await nextTick();

    if (organization) {
      const connectionStatus = orgConnection.getConnectionStatus(organization.serverUrl);
      const disconnectReason = orgConnection.getDisconnectReason(organization.serverUrl);

      // Prevent selecting organizations that are disconnected due to upgrade requirement
      if (connectionStatus === 'disconnected') {
        if (disconnectReason === 'upgradeRequired') {
          const versionStatus = getVersionStatusForOrg(organization.serverUrl);

          if (versionStatus === 'belowMinimum') {
            return;
          }
        }

        await reconnectOrganization(organization.serverUrl);
      }
    }

    selectedOrganization.value = await ush.getConnectedOrganization(organization, personal.value);
    await afterOrganizationSelection();
  };

  const refetchUserState = async () =>
    (selectedOrganization.value = await ush.refetchUserState(selectedOrganization.value));

  const refetchOrganizationTokens = async () => {
    organizationTokens.value = await ush.getOrganizationJwtTokens(personal.value);
  };

  const refetchOrganizations = async () => {
    await ush.updateConnectedOrganizations(organizations, personal.value);
    await refetchOrganizationTokens();
  };

  const deleteOrganization = async (organizationId: string) => {
    const removed = organizations.value.find(org => org.id === organizationId);
    organizations.value = organizations.value.filter(org => org.id !== organizationId);
    if (removed) resetVersionStatusForOrg(removed.serverUrl);
    await ush.deleteOrganizationConnection(organizationId, personal.value);
  };


  const getJwtToken = (organizationId?: string): string | null => {
    return organizationTokens.value[organizationId || selectedOrganization.value?.id || ''] || null;
  };

  const clearJwtToken = (organizationId: string): void => {
    organizationTokens.value[organizationId] = null;
  };

  /* AccountSetup */
  const setAccountSetupStarted = (value: boolean) => {
    accountSetupStarted.value = value;
  };

  /* Watchers */
  watch(
    () => network.network,
    async () => {
      await refetchAccounts();
      await refetchPublicKeys();
    },
  );

  watchEffect(() => {
    const userId = personal.value && 'id' in personal.value ? personal.value.id : undefined;
    const setupStarted = accountSetupStarted.value;
    if (userId) {
      if (setupStarted) {
        void safeAwait(add(userId, ACCOUNT_SETUP_STARTED, 'true'));
      } else {
        void safeAwait(remove(userId, [ACCOUNT_SETUP_STARTED]));
      }
    }
  });

  /* Exports */
  const exports = {
    keyPairs,
    publicKeyToAccounts,
    isLoadingAccountsOf,
    publicKeysToAccountsFlattened,
    recoveryPhrase,
    personal,
    selectedOrganization,
    organizations,
    secretHashes,
    publicKeys,
    accountSetupStarted,
    mnemonics,
    deleteOrganization,
    getJwtToken,
    getPassword,
    clearJwtToken,
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
