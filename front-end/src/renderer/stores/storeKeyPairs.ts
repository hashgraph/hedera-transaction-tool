import { defineStore } from 'pinia';

import { Prisma } from '@prisma/client';

import * as keyPairService from '@renderer/services/keyPairService';

const useKeyPairsStore = defineStore('keyPairs', () => {
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

  return {
    storeKeyPair,
  };
});

export default useKeyPairsStore;
