import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';

import { KeyPair, Organization, Prisma } from '@prisma/client';

import {
  PersonalUser,
  PublicKeyAccounts,
  RecoveryPhrase,
  ConnectedOrganization,
} from '@renderer/types';

import { useRouter } from 'vue-router';

import useNetworkStore from './storeNetwork';
import useContactsStore from './storeContacts';

import * as ush from '@renderer/utils/userStoreHelpers';

const useUserStore = defineStore('user', () => {
  /* Stores */
  const network = useNetworkStore();
  const contacts = useContactsStore();

  /* Composables */
  const router = useRouter();

  /* State */
  /** Keys */
  const publicKeyToAccounts = ref<PublicKeyAccounts[]>([]);
  const recoveryPhrase = ref<RecoveryPhrase | null>(null);
  const keyPairs = ref<KeyPair[]>([]);

  /** Personal */
  const personal = ref<PersonalUser | null>(null);

  /** Organization */
  const selectedOrganization = ref<ConnectedOrganization | null>(null);
  const organizations = ref<ConnectedOrganization[]>([]);

  /* Computed */
  /** Keys */
  const secretHashes = computed<string[]>(() => ush.getSecretHashesFromKeys(keyPairs.value));
  const publicKeys = computed(() => keyPairs.value.map(kp => kp.public_key));
  const shouldSetupAccount = computed(() =>
    ush.accountSetupRequired(selectedOrganization.value, keyPairs.value),
  );

  /* Actions */
  /** Personal */
  const login = async (id: string, email: string) => {
    personal.value = ush.createPersonalUser(id, email);
    await refetchKeys();
    await refetchOrganizations();
  };

  const logout = async () => {
    personal.value = ush.createPersonalUser();
    selectedOrganization.value = null;
    organizations.value.splice(0, organizations.value.length);
    publicKeyToAccounts.value.splice(0, publicKeyToAccounts.value.length);
    keyPairs.value = [];
  };

  /** Keys */
  const setRecoveryPhrase = async (words: string[]) => {
    recoveryPhrase.value = await ush.createRecoveryPhrase(words);
  };

  const refetchAccounts = async () => {
    publicKeyToAccounts.value = await ush.getPublicKeysToAccounts(
      keyPairs.value,
      network.mirrorNodeBaseURL,
    );
  };

  const refetchKeys = async () => {
    await ush.updateKeyPairs(keyPairs, personal.value, selectedOrganization.value);
    await refetchAccounts();
  };

  const storeKey = async (keyPair: Prisma.KeyPairUncheckedCreateInput, password: string) => {
    await ush.storeKeyPair(keyPair, secretHashes.value, password);
    await refetchKeys();
  };

  /** Organization */
  const selectOrganization = async (organization: Organization | null) => {
    if (!organization) {
      selectedOrganization.value = null;
      await contacts.fetch();
    } else {
      selectedOrganization.value = await ush.getConnectedOrganization(organization, personal.value);
    }
    await ush.afterOrganizationSelection(personal.value, selectedOrganization, keyPairs, router);
    await refetchAccounts();
    await contacts.fetch();
  };

  const refetchUserState = async () => await ush.refetchUserState(selectedOrganization);

  const refetchOrganizations = async () => {
    organizations.value = await ush.getConnectedOrganizations(personal.value);

    const updatedSelectedOrganization = organizations.value.find(
      o => o.id === selectedOrganization.value?.id,
    );

    if (updatedSelectedOrganization) {
      await selectOrganization(updatedSelectedOrganization);
    }
  };

  const deleteOrganization = async (organizationId: string) => {
    organizations.value = organizations.value.filter(org => org.id !== organizationId);
    await ush.deleteOrganizationConnection(organizationId, personal.value);
  };

  /* Watchers */
  watch(
    () => network.network,
    async () => {
      await refetchAccounts();
    },
  );
  /* Exports */
  const exports = {
    keyPairs,
    publicKeyToAccounts,
    recoveryPhrase,
    personal,
    selectedOrganization,
    organizations,
    secretHashes,
    publicKeys,
    shouldSetupAccount,
    login,
    logout,
    setRecoveryPhrase,
    refetchKeys,
    storeKey,
    selectOrganization,
    refetchUserState,
    deleteOrganization,
    refetchOrganizations,
  };

  return exports;
});

export default useUserStore;
