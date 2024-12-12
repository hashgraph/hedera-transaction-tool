import type { KeyPair } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';

import { MIGRATE_RECOVERY_PHRASE_HASH } from '@renderer/router';

import { getKeyPairs } from '@renderer/services/keyPairService';

import { isUserLoggedIn } from '@renderer/utils';

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

  const redirectIfRequiredKeysToMigrate = async () => {
    if ((await getRequiredKeysToMigrate()).length > 0) {
      await router.push({ name: MIGRATE_RECOVERY_PHRASE_HASH });
      return true;
    }
    return false;
  };

  return { getRequiredKeysToMigrate, redirectIfRequiredKeysToMigrate };
}
