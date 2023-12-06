import { onMounted, ref } from 'vue';
import { defineStore } from 'pinia';

import { IKeyPair, IKeyPairWithAccountId } from '../../main/shared/interfaces/IKeyPair';

import * as keyPairService from '../services/keyPairService';

import useMirrorNodeLinksStore from './storeMirrorNodeLinks';

const useKeyPairsStore = defineStore('keyPairs', () => {
  /* Stores */
  const mirrorNodeLinksStore = useMirrorNodeLinksStore();

  /* State */
  const recoveryPhraseWords = ref<string[]>([]);
  const keyPairs = ref<IKeyPairWithAccountId[]>([]);

  /* Actions */
  async function refetch() {
    keyPairs.value = await keyPairService.getStoredKeyPairs();

    keyPairs.value.forEach(async kp => {
      kp.accountId = await keyPairService.getAccountId(mirrorNodeLinksStore.mainnet, kp.publicKey);
    });
  }

  async function setRecoveryPhrase(words: string[]) {
    if (words.length === 24) {
      recoveryPhraseWords.value = words;
    }
  }

  async function storeKeyPair(password: string, keyPair: IKeyPair) {
    await keyPairService.storeKeyPair(password, keyPair);
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
    storeKeyPair,
    refetch,
  };
});

export default useKeyPairsStore;
