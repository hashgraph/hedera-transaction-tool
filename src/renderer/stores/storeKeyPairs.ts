import { onMounted, ref } from 'vue';
import { defineStore } from 'pinia';

import { IKeyPair, IKeyPairWithAccountId } from '../../main/shared/interfaces/IKeyPair';

import * as keyPairService from '../services/keyPairService';

import useMirrorNodeLinksStore from './storeMirrorNodeLinks';
import useUserStateStore from './storeUserState';

const useKeyPairsStore = defineStore('keyPairs', () => {
  /* Stores */
  const mirrorNodeLinksStore = useMirrorNodeLinksStore();
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
      kp.accountId = await keyPairService.getAccountId(mirrorNodeLinksStore.mainnet, kp.publicKey);
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

  async function storeKeyPair(password: string, keyPair: IKeyPair) {
    if (!userStateStore.isLoggedIn || !userStateStore.userData || !userStateStore.userData.userId) {
      throw Error('User is not logged in!');
    }

    await keyPairService.storeKeyPair(userStateStore.userData.userId, password, keyPair);
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
