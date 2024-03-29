import { computed, reactive, ref } from 'vue';
import { defineStore } from 'pinia';

import { KeyPair } from '@prisma/client';

import {
  PersonalUser,
  PublicKeyAccounts,
  RecoveryPhrase,
  ConnectedOrganization,
} from '@renderer/types';

const useUserStore = defineStore('user', () => {
  /* State */
  /** Keys */
  const keyPairs = ref<KeyPair[]>([]);
  const publicKeyToAccounts = ref<PublicKeyAccounts[]>([]);
  const recoveryPhrase = ref<RecoveryPhrase | null>(null);

  /** Personal */
  const personal = reactive<PersonalUser>({
    isLoggedIn: false,
  });

  /** Organization */
  const selectedOrganization = ref<ConnectedOrganization | null>(null);
  const organizations = ref<ConnectedOrganization[]>([]);

  /* Computed */
  /** Keys */
  const secretHashes = computed(() => keyPairs.value.map(kp => kp.secret_hash).filter(Boolean));
  const publicKeys = computed(() => keyPairs.value.map(kp => kp.public_key));

  return {
    keyPairs,
    publicKeyToAccounts,
    recoveryPhrase,
    personal,
    selectedOrganization,
    organizations,
    secretHashes,
    publicKeys,
  };
});

export default useUserStore;
