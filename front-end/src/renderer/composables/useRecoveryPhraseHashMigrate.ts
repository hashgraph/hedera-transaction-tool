import type { KeyPair } from '@prisma/client';

import { MIGRATE_RECOVERY_PHRASE_HASH } from '@renderer/router';

import useUserStore from '@renderer/stores/storeUser';

import { useRoute, useRouter } from 'vue-router';

import {
  getKeyPairs,
  updateMnemonicHash as updateLocalMnemonicHash,
} from '@renderer/services/keyPairService';
import { compareHash } from '@renderer/services/electronUtilsService';
import { updateKey as updateOrganizationKey } from '@renderer/services/organization';

import {
  getRecoveryPhraseHashValue,
  isLoggedInOrganization,
  isUserLoggedIn,
  safeAwait,
} from '@renderer/utils';

export default function useRecoveryPhraseHashMigrate() {
  /* Constants */
  const ARGON_HEADER = 'argon2';

  /* Stores */
  const user = useUserStore();

  /* Composables */
  const router = useRouter();
  const route = useRoute();

  /* Functions */
  const getRequiredKeysToMigrate = async (): Promise<KeyPair[]> => {
    if (!isUserLoggedIn(user.personal)) {
      return [];
    }

    const localKeysPairs = await getKeyPairs(
      user.personal.id,
      user.selectedOrganization?.id || null,
    );
    return localKeysPairs.filter(
      localKeyPair => localKeyPair.secret_hash && !localKeyPair.secret_hash.includes(ARGON_HEADER),
    );
  };

  const getKeysToUpdateForRecoveryPhrase = async (
    recoveryPhraseWords: string[],
  ): Promise<KeyPair[]> => {
    const localKeyPairsToUpdate = await getRequiredKeysToMigrate();
    const keyIds: KeyPair[] = [];

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

  const updateKeyPairsHash = async (
    localKeyPairs: KeyPair[],
    recoveryPhraseHash: string,
  ): Promise<void> => {
    for (const localKeyPair of localKeyPairs) {
      if (isLoggedInOrganization(user.selectedOrganization)) {
        const organizationKeyPair = user.selectedOrganization.userKeys.find(
          key => key.publicKey === localKeyPair.public_key,
        );
        if (organizationKeyPair) {
          await updateOrganizationKey(
            user.selectedOrganization.serverUrl,
            user.selectedOrganization.userId,
            organizationKeyPair.id,
            recoveryPhraseHash,
          );
        }
      }
      await updateLocalMnemonicHash(localKeyPair.id, recoveryPhraseHash);
    }
    await user.refetchUserState();
    await user.refetchKeys();
  };

  const tryMigrateOrganizationKeys = async (localOrganizationKeys: KeyPair[]): Promise<void> => {
    if (!isUserLoggedIn(user.personal)) {
      return;
    }

    const personalKeys = await getKeyPairs(user.personal.id, null);
    const hashToKeys: { [hash: string]: KeyPair[] } = {};
    const keyAddedToUpdate: { [localKeyId: string]: boolean } = {};

    if (user.recoveryPhrase) {
      const personalKeysSecretHashes: string[] = [];
      for (const personalKey of personalKeys) {
        if (
          personalKey.secret_hash &&
          personalKey.secret_hash.includes(ARGON_HEADER) &&
          !personalKeysSecretHashes.includes(personalKey.secret_hash)
        ) {
          personalKeysSecretHashes.push(personalKey.secret_hash);
        }
      }

      let argonHashForRecoveryPhrase: string | null = null;

      for (const personalKeyHash of personalKeysSecretHashes) {
        const { data } = await safeAwait(
          compareHash(getRecoveryPhraseHashValue(user.recoveryPhrase.words), personalKeyHash),
        );

        if (data) {
          argonHashForRecoveryPhrase = personalKeyHash;
          hashToKeys[argonHashForRecoveryPhrase] = [];
          break;
        }
      }

      const localOrganizationKeyHashes: string[] = [];
      const localOrganizationHashToKeys: { [hash: string]: KeyPair[] } = {};
      for (const localOrganizationKey of localOrganizationKeys) {
        if (
          localOrganizationKey.secret_hash &&
          !localOrganizationKey.secret_hash.includes(ARGON_HEADER)
        ) {
          if (!localOrganizationKeyHashes.includes(localOrganizationKey.secret_hash)) {
            localOrganizationKeyHashes.push(localOrganizationKey.secret_hash);
          }
          if (!localOrganizationHashToKeys[localOrganizationKey.secret_hash]) {
            localOrganizationHashToKeys[localOrganizationKey.secret_hash] = [];
          }
          localOrganizationHashToKeys[localOrganizationKey.secret_hash].push(localOrganizationKey);
        }
      }

      if (argonHashForRecoveryPhrase) {
        for (const localOrganizationKeyHash of localOrganizationKeyHashes) {
          const { data } = await safeAwait(
            compareHash(
              getRecoveryPhraseHashValue(user.recoveryPhrase.words),
              localOrganizationKeyHash,
            ),
          );

          if (data) {
            hashToKeys[argonHashForRecoveryPhrase] =
              localOrganizationHashToKeys[localOrganizationKeyHash];
          }
        }
      }
    }

    for (const personalKey of personalKeys) {
      const isArgonHash = personalKey.secret_hash?.includes(ARGON_HEADER);

      if (personalKey.secret_hash && isArgonHash) {
        const organizationKey = localOrganizationKeys.find(
          lok => lok.public_key === personalKey.public_key,
        );

        if (organizationKey) {
          for (const localOrganizationKey of localOrganizationKeys) {
            const hasSameHash = localOrganizationKey.secret_hash === organizationKey.secret_hash;
            const isAlreadyAdded = keyAddedToUpdate[localOrganizationKey.id];

            if (hasSameHash && !isAlreadyAdded) {
              if (!hashToKeys[personalKey.secret_hash]) {
                hashToKeys[personalKey.secret_hash] = [];
              }

              hashToKeys[personalKey.secret_hash].push(localOrganizationKey);
              keyAddedToUpdate[localOrganizationKey.id] = true;
            }
          }
        }
      }
    }

    for (const [hash, keys] of Object.entries(hashToKeys)) {
      await safeAwait(updateKeyPairsHash(keys, hash));
    }
  };

  const redirectIfRequiredKeysToMigrate = async (): Promise<boolean> => {
    let keysToMigrate = await getRequiredKeysToMigrate();

    if (isLoggedInOrganization(user.selectedOrganization) && keysToMigrate.length > 0) {
      await safeAwait(tryMigrateOrganizationKeys(keysToMigrate));
      keysToMigrate = await getRequiredKeysToMigrate();
    }

    if (keysToMigrate.length > 0) {
      await router.push({ name: MIGRATE_RECOVERY_PHRASE_HASH });
      return true;
    } else if (route.name === MIGRATE_RECOVERY_PHRASE_HASH) {
      await router.push(
        router.previousPath ? { path: router.previousPath } : { name: 'transactions' },
      );
    }
    return false;
  };

  return {
    getRequiredKeysToMigrate,
    getKeysToUpdateForRecoveryPhrase,
    redirectIfRequiredKeysToMigrate,
    updateKeyPairsHash,
  };
}
