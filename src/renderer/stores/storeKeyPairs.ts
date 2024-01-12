import { onMounted, ref } from 'vue';
import { defineStore } from 'pinia';

import { IKeyPair, IKeyPairWithAccountId } from '../../main/shared/interfaces';

import useNetworkStore from './storeNetwork';
import useUserStore from './storeUser';

import * as keyPairService from '../services/keyPairService';
import * as mirrorNodeDataService from '../services/mirrorNodeDataService';

const useKeyPairsStore = defineStore('keyPairs', () => {
  /* Stores */
  const networkStore = useNetworkStore();
  const user = useUserStore();

  /* State */
  const recoveryPhraseWords = ref<string[]>([]);
  const keyPairs = ref<IKeyPairWithAccountId[]>([]);

  /* Actions */
  async function refetch() {
    if (!user.data.isLoggedIn) {
      throw Error('Please login to get stored keys!');
    }

    keyPairs.value = await keyPairService.getStoredKeyPairs(
      user.data.email,
      user.data.activeServerURL,
      user.data.activeUserId,
    );

    keyPairs.value.forEach(async kp => {
      kp.accountId = await mirrorNodeDataService.getAccountId(
        networkStore.mirrorNodeBaseURL,
        kp.publicKey,
      );
    });
  }

  function setRecoveryPhrase(words: string[]) {
    if (words.length === 24) {
      recoveryPhraseWords.value = words;
    }
  }

  function clearRecoveryPhrase() {
    recoveryPhraseWords.value = [];
  }

  async function storeKeyPair(password: string, keyPair: IKeyPair, secretHash?: string) {
    if (!user.data.isLoggedIn) {
      throw Error('Personal user is not logged in!');
    }

    if (
      user.data.secretHashes.length > 0 &&
      secretHash &&
      !user.data.secretHashes.includes(secretHash)
    ) {
      throw Error('Different recovery phrase is used!');
    }

    await keyPairService.storeKeyPair(
      user.data.email,
      password,
      keyPair,
      secretHash,
      user.data.activeServerURL,
      user.data.activeUserId,
    );

    await refetch();
  }

  /* Lifecycle hooks */
  onMounted(async () => {
    if (user.data.isLoggedIn) {
      await refetch();
    }
  });

  return {
    recoveryPhraseWords,
    keyPairs,
    setRecoveryPhrase,
    clearRecoveryPhrase,
    storeKeyPair,
    refetch,
  };
});

export default useKeyPairsStore;
