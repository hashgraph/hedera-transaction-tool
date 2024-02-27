import {computed, onMounted, reactive, ref} from 'vue';
import {defineStore} from 'pinia';

import {KeyPair, Prisma} from '@prisma/client';

import useNetworkStore from './storeNetwork';
import useUserStore from './storeUser';

import * as keyPairService from '@renderer/services/keyPairService';
import * as mirrorNodeDataService from '@renderer/services/mirrorNodeDataService';

const useKeyPairsStore = defineStore('keyPairs', () => {
  /* Stores */
  const networkStore = useNetworkStore();
  const user = useUserStore();

  /* State */
  const recoveryPhraseWords = ref<string[]>([]);
  const keyPairs = ref<KeyPair[]>([]);
  const accoundIds = reactive<{publicKey: string; accountIds: string[]}[]>([]);

  /* Getters */
  const publicKeys = computed(() => keyPairs.value.map(kp => kp.public_key));

  /* Actions */
  async function refetch() {
    if (!user.data.isLoggedIn) {
      throw Error('Please login to get stored keys!');
    }

    keyPairs.value = (await keyPairService.getKeyPairs(user.data.id)).sort((k1, k2) => {
      if (k1.index < 0) {
        return 1;
      } else {
        return k1.index - k2.index;
      }
    });

    for (let i = 0; i < keyPairs.value.length; i++) {
      const keyPair = keyPairs.value[i];

      const publicKeyPair = accoundIds.find(acc => acc.publicKey === keyPair.public_key);

      const accounts = await mirrorNodeDataService.getAccountId(
        networkStore.mirrorNodeBaseURL,
        keyPair.public_key,
      );

      if (publicKeyPair) {
        publicKeyPair.accountIds = accounts;
      } else {
        accoundIds.push({
          publicKey: keyPair.public_key,
          accountIds: accounts,
        });
      }
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

  /* Lifecycle hooks */
  onMounted(async () => {
    if (user.data.isLoggedIn) {
      await refetch();
    }
  });

  return {
    recoveryPhraseWords,
    keyPairs,
    accoundIds,
    publicKeys,
    setRecoveryPhrase,
    clearRecoveryPhrase,
    storeKeyPair,
    refetch,
  };
});

export default useKeyPairsStore;
