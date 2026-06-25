import { computed, ref, watch, type Ref } from "vue";
import { defineStore } from 'pinia';

import useUserStore from '@renderer/stores/storeUser.ts';
import useNetworkStore from '@renderer/stores/storeNetwork.ts';
import type { PublicKeyAccounts, RecoveryPhrase } from '@renderer/types';
import  { type KeyPair, type Mnemonic, Prisma, type PublicKeyMapping } from '@prisma/client';
import * as ush from '@renderer/utils/userStoreHelpers.ts';
import * as pks from '@renderer/services/publicKeyMappingService.ts';
import { AppCache } from '@renderer/caches/AppCache.ts';
import { isUserLoggedIn } from '@renderer/utils/userStoreHelpers.ts';

const useKeysStore = defineStore('keys', () => {

  /* Injected */
  const accountByKeyCache = AppCache.inject().mirrorAccountByPublicKey;

  /* Stores */
  const user = useUserStore();
  const network = useNetworkStore();

  /* State */
  const publicKeyToAccounts = ref<PublicKeyAccounts[]>([]);
  const recoveryPhrase: Ref<RecoveryPhrase | null> = ref(null);
  const keyPairs = ref<KeyPair[]>([]);
  const mnemonics = ref<Mnemonic[]>([]);
  const publicKeyMappings = ref<PublicKeyMapping[]>([]);

  /* Computed */
  const secretHashes = computed<string[]>(() => ush.getSecretHashesFromKeys(keyPairs.value));
  const publicKeys = computed(() => keyPairs.value.map(kp => kp.public_key));
  const publicKeysToAccountsFlattened = computed(() =>
    ush.flattenAccountIds(publicKeyToAccounts.value),
  );

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
    if (ush.isUserLoggedIn(user.personal)) {
      keyPairs.value = await ush.getLocalKeyPairs(user.personal, user.selectedOrganization);
    } else {
      keyPairs.value = [];
    }
  };

  const refetchPublicKeys = async () => {
    publicKeyMappings.value = await ush.getAllPublicKeyMappings();
  };

  const refetchMnemonics = async () => {
    if (ush.isUserLoggedIn(user.personal)) {
      mnemonics.value = await ush.getMnemonics(user.personal);
    } else {
      mnemonics.value = [];
    }
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
    await pks.deletePublicKey(id);
    await refetchPublicKeys();
  };

  /* Watchers */
  watch(() => user.personal, () => {
    if (!isUserLoggedIn(user.personal)) {
      publicKeyToAccounts.value = [];
      keyPairs.value = [];
      recoveryPhrase.value = null;
    }
  });

  watch(
    () => network.network,
    async () => {
      await refetchAccounts();
      await refetchPublicKeys();
    },
  );

  /* Exports */
  const exports = {
    keyPairs,
    publicKeyToAccounts,
    publicKeysToAccountsFlattened,
    recoveryPhrase,
    secretHashes,
    publicKeys,
    mnemonics,
    refetchAccounts,
    refetchKeys,
    refetchMnemonics,
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

export default useKeysStore;
