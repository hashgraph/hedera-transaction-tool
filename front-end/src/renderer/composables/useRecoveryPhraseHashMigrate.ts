import type { KeyPair } from '@prisma/client';

import { MIGRATE_RECOVERY_PHRASE_HASH } from '@renderer/router';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';

import {
  getKeyPairs,
  updateMnemonicHash as updateLocalMnemonicHash,
} from '@renderer/services/keyPairService';
import { compareHash } from '@renderer/services/electronUtilsService';

import { getRecoveryPhraseHashValue, isUserLoggedIn, safeAwait } from '@renderer/utils';

export default function useRecoveryPhraseHashMigrate() {
  /* Constants */
  const ARGON_HEADER = 'argon2';

  /* Composables */
  const router = useRouter();

  /* Stores */
  const user = useUserStore();

  /* Functions */
  const getRequiredKeysToMigrate = async () => {
    if (!isUserLoggedIn(user.personal)) {
      return [];
    }

    const keyPairsToMigrate: KeyPair[] = [];

    const allLocalKeysPairs = await getKeyPairs(
      user.personal.id,
      user.selectedOrganization?.id || null,
    );

    for (const localKeyPair of allLocalKeysPairs) {
      const hasHash = localKeyPair.secret_hash !== null;
      const isArgonHash = localKeyPair.secret_hash?.includes(ARGON_HEADER);

      if (hasHash && !isArgonHash) {
        keyPairsToMigrate.push(localKeyPair);
      }
    }

    return keyPairsToMigrate;
  };

  const getKeysToUpdateForRecoveryPhrase = async (recoveryPhraseWords: string[]) => {
    const keyIds: KeyPair[] = [];
    const localKeyPairsToUpdate = await getRequiredKeysToMigrate();
    for (const localKeyPair of localKeyPairsToUpdate) {
      if (localKeyPair.secret_hash) {
        const { data } = await safeAwait(
          compareHash(getRecoveryPhraseHashValue(recoveryPhraseWords), localKeyPair.secret_hash),
        );

        if (data) {
          keyIds.push(localKeyPair);
        }
      }
    }
    return keyIds;
  };

  const updateLocalKeysHash = async (localKeyPairs: KeyPair[], recoveryPhraseHash: string) => {
    for (const localKey of localKeyPairs) {
      await updateLocalMnemonicHash(localKey.id, recoveryPhraseHash);
    }
  };

  const redirectIfRequiredKeysToMigrate = async () => {
    if ((await getRequiredKeysToMigrate()).length > 0) {
      await router.push({ name: MIGRATE_RECOVERY_PHRASE_HASH });
      return true;
    }
    return false;
  };

  return {
    getRequiredKeysToMigrate,
    getKeysToUpdateForRecoveryPhrase,
    redirectIfRequiredKeysToMigrate,
    updateLocalKeysHash,
  };
}
