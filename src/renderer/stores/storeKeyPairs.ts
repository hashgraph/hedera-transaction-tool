import { onMounted, ref } from 'vue';
import { defineStore } from 'pinia';

import { IKeyPair, IKeyPairWithAccountId } from '../../main/shared/interfaces';

import * as keyPairService from '../services/keyPairService';

import useNetworkStore from './storeNetwork';
import useUserStateStore from './storeUserState';

const useKeyPairsStore = defineStore('keyPairs', () => {
  /* Stores */
  const networkStore = useNetworkStore();
  const userStateStore = useUserStateStore();

  /* State */
  const recoveryPhraseWords = ref<string[]>([]);
  const keyPairs = ref<IKeyPairWithAccountId[]>([]);

  /* Actions */
  async function refetch() {
    if (!userStateStore.userData?.userId) {
      throw Error('Please login to get stored keys!');
    }

    keyPairs.value = await keyPairService.getStoredKeyPairs(userStateStore.userData.userId);

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
    if (!userStateStore.isLoggedIn || !userStateStore.userData || !userStateStore.userData.userId) {
      throw Error('User is not logged in!');
    }

    if (!userStateStore.secretHashes) {
      throw Error('Key Pair not matched to a recovery phrase');
    } else if (!userStateStore.secretHashes.includes(secretHash)) {
      throw Error('Different recovery phrase is used!');
    }

    await keyPairService.storeKeyPair(
      userStateStore.userData.userId,
      password,
      secretHash,
      keyPair,
    );
    await refetch();
  }

  /* Lifecycle hooks */
  onMounted(() => {
    refetch();
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
