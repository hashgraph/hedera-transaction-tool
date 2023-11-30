import { computed, onMounted, ref } from 'vue';

import { defineStore } from 'pinia';

import * as keyPairService from '../services/keyPairService';

import useMirrorNodeLinksStore from './storeMirrorNodeLinks';

const useKeyPairsStore = defineStore('keyPairs', () => {
  /* Stores */
  const mirrorNodeLinksStore = useMirrorNodeLinksStore();

  /* State */
  const recoveryPhraseWords = ref<string[]>([]);
  const keyPairs = ref<
    { privateKey: string; index: number; publicKey: string; accountId?: string }[]
  >([]);

  /* Getters */
  const indexes = computed(() => keyPairs.value.map(kp => kp.index));

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

  async function generatePrivateKey(passphrase: string, index: number) {
    if (indexes.value.includes(index)) {
      return; //ALERT THAT THIS KEY IS ALREADY ADDED
    }

    const privateKey = await keyPairService.generatePrivateKey(
      recoveryPhraseWords.value,
      passphrase,
      index,
    );

    await keyPairService.storePrivateKey(privateKey.toStringRaw(), index);

    await refetch();

    return {
      privateKey: privateKey.toStringRaw(),
      index: index,
      publicKey: privateKey._key.publicKey.toStringRaw(),
    };
  }

  /* Lifecycle hooks */
  onMounted(() => {
    refetch();
  });
  return {
    recoveryPhraseWords,
    keyPairs,
    setRecoveryPhrase,
    generatePrivateKey,
    refetch,
  };
});

export default useKeyPairsStore;
