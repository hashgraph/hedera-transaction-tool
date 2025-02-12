import type { KeyPair, Mnemonic, Organization } from '@prisma/client';

import type {
  PersonalUser,
  PublicKeyAccounts,
  RecoveryPhrase,
  ConnectedOrganization,
  OrganizationTokens,
} from '@renderer/types';

import { computed, ref, watch, nextTick } from 'vue';
import { defineStore } from 'pinia';

import { Prisma } from '@prisma/client';

import useAfterOrganizationSelection from '@renderer/composables/user/useAfterOrganizationSelection';

import * as ush from '@renderer/utils/userStoreHelpers';

import useNetworkStore from './storeNetwork';

const useUserStore = defineStore('user', () => {
  /* Stores */
  const network = useNetworkStore();

  /* Composables */
  const afterOrganizationSelection = useAfterOrganizationSelection();

  /* State */
  /** Keys */
  const publicKeyToAccounts = ref<PublicKeyAccounts[]>([]);
  const recoveryPhrase = ref<RecoveryPhrase | null>(null);
  const keyPairs = ref<KeyPair[]>([]);
  const mnemonics = ref<Mnemonic[]>([]);

  /** Personal */
  const personal = ref<PersonalUser | null>(null);
  const passwordStoreDuration = ref<number>(10 * 60 * 1_000);

  /** Organization */
  const selectedOrganization = ref<ConnectedOrganization | null>(null);
  const organizations = ref<ConnectedOrganization[]>([]);
  const organizationTokens = ref<OrganizationTokens>({});
  const skippedSetup = ref<boolean>(false);

  /** Migration */
  const migrating = ref<boolean>(false);

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
    );
  };

  const refetchKeys = async () => {
    keyPairs.value = await ush.getLocalKeyPairs(personal.value, selectedOrganization.value);
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
    refetchAccounts();
  };

  /* Organization */
  const selectOrganization = async (organization: Organization | null) => {
    await nextTick();
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

  /* Migration */
  const setMigrating = (value: boolean) => (migrating.value = value);

  /* Watchers */
  watch(
    () => network.network,
    () => {
      refetchAccounts();
    },
  );

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
    migrating,
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
    setMigrating,
    setPassword,
    setPasswordStoreDuration,
    setRecoveryPhrase,
    storeKey,
  };

  return exports;
});

export default useUserStore;
