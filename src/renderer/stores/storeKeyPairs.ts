import { onMounted, ref } from 'vue';
import { defineStore } from 'pinia';

import { IKeyPair, IKeyPairWithAccountId } from '../../main/shared/interfaces';

import useNetworkStore from './storeNetwork';
import useLocalUserStateStore from './storeLocalUserState';
import useUserStateStore from './storeUserState';

import * as keyPairService from '../services/keyPairService';

const useKeyPairsStore = defineStore('keyPairs', () => {
  /* Stores */
  const networkStore = useNetworkStore();
  const localUserStateStore = useLocalUserStateStore();
  const userStateStore = useUserStateStore();

  /* State */
  const recoveryPhraseWords = ref<string[]>([]);
  const keyPairs = ref<IKeyPairWithAccountId[]>([]);

  /* Actions */
  async function refetch() {
    if (!localUserStateStore.email) {
      throw Error('Please login to get stored keys!');
    }

    keyPairs.value = await keyPairService.getStoredKeyPairs(
      localUserStateStore.email,
      userStateStore.serverUrl,
      userStateStore.userId,
    );

    keyPairs.value.forEach(async kp => {
      kp.accountId = await keyPairService.getAccountId(
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

  async function storeKeyPair(password: string, secretHash: string, keyPair: IKeyPair) {
    if (!localUserStateStore.isLoggedIn || !localUserStateStore.email) {
      throw Error('Personal user is not logged in!');
    }

    if (userStateStore.isLoggedIn) {
      if (!userStateStore.secretHashes?.includes(secretHash)) {
        throw Error('Different recovery phrase is used!');
      }

      await keyPairService.storeKeyPair(
        localUserStateStore.email,
        password,
        secretHash,
        keyPair,
        userStateStore.serverUrl,
        userStateStore.userId,
      );
    } else {
      if (!localUserStateStore.secretHashes?.includes(secretHash)) {
        throw Error('Different recovery phrase is used!');
      }

      await keyPairService.storeKeyPair(localUserStateStore.email, password, secretHash, keyPair);
    }

    await refetch();
  }

  /* Lifecycle hooks */
  onMounted(async () => {
    await refetch();
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
