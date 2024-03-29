import { ref, watch } from 'vue';
import { defineStore } from 'pinia';

import { KeyPair, Prisma } from '@prisma/client';

import useNetworkStore from './storeNetwork';
import useUserStore from './storeUser';

import * as keyPairService from '@renderer/services/keyPairService';
import * as mirrorNodeDataService from '@renderer/services/mirrorNodeDataService';

const useKeyPairsStore = defineStore('keyPairs', () => {
  /* Stores */
  const network = useNetworkStore();
  const user = useUserStore();

  /* State */
  const recoveryPhraseWords = ref<string[]>([]);
  const keyPairs = ref<KeyPair[]>([]);
  const refetching = ref(false);

  /* Actions */
  async function refetch() {
    if (!user.data.isLoggedIn) {
      throw Error('Please login to get stored keys!');
    }

    keyPairs.value = (
      await keyPairService.getKeyPairs(
        user.data.id,
        user.data.activeOrganization ? user.data.activeOrganization.id : null,
      )
    ).sort((k1, k2) => {
      if (k1.index < 0) {
        return 1;
      } else {
        return k1.index - k2.index;
      }
    });

    const secretHashes = await keyPairService.getSecretHashes(
      user.data.id,
      user.data.activeOrganization ? user.data.activeOrganization.id : null,
    );
    user.data.secretHashes = secretHashes;

    publicKeyToAccounts.value = [];

    for (let i = 0; i < keyPairs.value.length; i++) {
      const keyPair = keyPairs.value[i];

      const publicKeyPair = publicKeyToAccounts.value.findIndex(
        pkToAcc => pkToAcc.publicKey === keyPair.public_key,
      );

      const accounts = await mirrorNodeDataService.getAccountsByPublicKey(
        network.mirrorNodeBaseURL,
        keyPair.public_key,
      );

      if (publicKeyPair >= 0) {
        publicKeyToAccounts.value[publicKeyPair].accounts = accounts;
      } else {
        publicKeyToAccounts.value.push({
          publicKey: keyPair.public_key,
          accounts: accounts,
        });
      }

      publicKeyToAccounts.value = [...publicKeyToAccounts.value];
    }
  }

  function setRecoveryPhrase(words: string[]) {
    if (words.length === 24) {
      recoveryPhraseWords.value = words;
    }
  }

  function clearRecoveryPhrase() {
    recoveryPhraseWords.value = [];
  }

  function clearKeyPairs() {
    keyPairs.value = [];
    publicKeyToAccounts.value = [];
  }

  async function storeKeyPair(keyPair: Prisma.KeyPairUncheckedCreateInput, password: string) {
    if (!user.data.isLoggedIn) {
      throw Error('Personal user is not logged in!');
    }

    if (
      user.data.secretHashes.length > 0 &&
      keyPair.secret_hash &&
      !user.data.secretHashes.includes(keyPair.secret_hash)
    ) {
      throw Error('Different recovery phrase is used!');
    }

    await keyPairService.storeKeyPair(keyPair, password);

    await refetch();
  }

  function getNickname(publicKey: string) {
    const keyPair = keyPairs.value.find(kp => kp.public_key === publicKey);
    return keyPair?.nickname || undefined;
  }

  /* Watchers */
  watch(
    [() => user.data.isLoggedIn, () => user.data.activeOrganization, () => network.network],
    async () => {
      if (user.data.isLoggedIn) {
        try {
          refetching.value = true;
          await refetch();
        } finally {
          refetching.value = false;
        }
      }
    },
  );

  return {
    recoveryPhraseWords,
    keyPairs,
    publicKeyToAccounts,
    publicKeys,
    refetching,
    setRecoveryPhrase,
    clearKeyPairs,
    clearRecoveryPhrase,
    storeKeyPair,
    refetch,
    getNickname,
  };
});

export default useKeyPairsStore;
