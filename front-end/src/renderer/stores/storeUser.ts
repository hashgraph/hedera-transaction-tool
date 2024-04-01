import { computed, reactive, ref, watch } from 'vue';
import { defineStore } from 'pinia';

import { KeyPair, Prisma } from '@prisma/client';

import {
  PersonalUser,
  PublicKeyAccounts,
  RecoveryPhrase,
  ConnectedOrganization,
} from '@renderer/types';

import useNetworkStore from './storeNetwork';

import * as ush from '@renderer/utils/userStoreHelpers';

const useUserStore = defineStore('user', () => {
  /* Stores */
  const network = useNetworkStore();

  /* State */
  /** Keys */
  const publicKeyToAccounts = ref<PublicKeyAccounts[]>([]);
  const recoveryPhrase = ref<RecoveryPhrase | null>(null);
  const keyPairs = reactive<KeyPair[]>([]);

  /** Personal */
  const personal = ref<PersonalUser | null>(null);

  /** Organization */
  const selectedOrganization = ref<ConnectedOrganization | null>(null);
  const organizations = ref<ConnectedOrganization[]>([]);

  /* Computed */
  /** Keys */
  const secretHashes = computed<string[]>(() => ush.getSecretHashesFromKeys(keyPairs));
  const publicKeys = computed(() => keyPairs.map(kp => kp.public_key));
  const shouldSetupAccount = computed(() =>
    ush.accountSetupRequired(selectedOrganization.value, keyPairs, secretHashes.value),
  );

  /* Actions */
  const login = async (id: string, email: string) => {
    personal.value = ush.createPersonalUser(id, email);
  };

  const logout = () => {
    personal.value = ush.createPersonalUser();
  };

  const setRecoveryPhrase = async (words: string[]) => {
    recoveryPhrase.value = await ush.createRecoveryPhrase(words);
  };

  const refetchKeys = async () => {
    keyPairs.splice(0, keyPairs.length);
    if (personal.value?.isLoggedIn) {
      const newKeys = await ush.getLocalKeyPairs(personal.value, selectedOrganization.value);
      keyPairs.push(...newKeys);
      publicKeyToAccounts.value = await ush.getPublicKeysToAccounts(
        newKeys,
        network.mirrorNodeBaseURL,
      );
    }
  };

  const storeKey = async (keyPair: Prisma.KeyPairUncheckedCreateInput, password: string) => {
    await ush.storeKeyPair(keyPair, secretHashes.value, password);
    await refetchKeys();
  };

  /* Watchers */
  watch([personal, selectedOrganization, () => network.network], async () => {
    await refetchKeys();
  });

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
  };

  return exports;
});

export default useUserStore;
