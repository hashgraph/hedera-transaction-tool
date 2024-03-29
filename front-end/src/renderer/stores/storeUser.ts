import { computed, reactive, ref } from 'vue';
import { defineStore } from 'pinia';

import { KeyPair } from '@prisma/client';

import {
  PersonalUser,
  PublicKeyAccounts,
  RecoveryPhrase,
  ConnectedOrganization,
} from '@renderer/types';
import * as ush from '@renderer/utils/userStoreHelpers';

const useUserStore = defineStore('user', () => {
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
  const login = (userId: string, email: string) => {
    ush.handleLogin(personal, userId, email);
  };

  const logout = () => {
    ush.handleLogout(personal);
  };

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
  };

  return exports;
});

export default useUserStore;
