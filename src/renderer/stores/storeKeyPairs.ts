import { computed, onMounted, ref } from 'vue';

import { defineStore } from 'pinia';

import * as keyPairService from '../services/keyPairService';

import useMirrorNodeLinksStore from './storeMirrorNodeLinks';

const useKeyPairsStore = defineStore('keyPairs', () => {
  const mirrorNodeLinksStore = useMirrorNodeLinksStore();

  const recoveryPhraseWords = ref<string[]>([]);
  const keyPairs = ref<
    { privateKey: string; index: number; publicKey: string; accountId?: string }[]
  >([]);

  const indexes = computed(() => keyPairs.value.map(kp => kp.index));

  onMounted(() => {
    refetch();
  });

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

  async function checkIsAccount() {}

  return {
    recoveryPhraseWords,
    keyPairs,
    setRecoveryPhrase,
    generatePrivateKey,
    checkIsAccount,
    refetch,
  };
});

export default useKeyPairsStore;
