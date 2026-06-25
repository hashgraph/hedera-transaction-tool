import type { KeyPair } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useKeysStore from '@renderer/stores/storeKeys';

import {
  restorePrivateKey,
  updateIndex,
  updateMnemonicHash as updateLocalMnemonicHash,
} from '@renderer/services/keyPairService';
import { updateKey as updateOrganizationKey } from '@renderer/services/organization';

import { isLoggedInOrganization, safeAwait } from '@renderer/utils';
import { computed, type Ref } from 'vue';

export default function useMatchRecoveryPrase() {
  /* Stores */
  const user = useUserStore();
  const keys = useKeysStore();

  /* Computed */
  const externalKeys = computed(() => keys.keyPairs.filter(k => !k.secret_hash));

  /* Functions */
  const startMatching = async (
    startIndex: number,
    endIndex: number,
    abortController: AbortController,
    totalRef: Ref<number>,
  ) => {
    if (!keys.recoveryPhrase) {
      throw new Error('Recovery phrase is not set');
    }

    let count = 0;

    for (let i = startIndex; i <= endIndex; i++) {
      if (abortController.signal.aborted || externalKeys.value.length === count) {
        break;
      }

      const pkED25519 = await restorePrivateKey(keys.recoveryPhrase.words, '', i, 'ED25519');
      const pkECDSA = await restorePrivateKey(keys.recoveryPhrase.words, '', i, 'ECDSA');

      const keyPairED25519 = externalKeys.value.find(
        k => k.public_key === pkED25519.publicKey.toStringRaw(),
      );
      const keyPairECDSA = externalKeys.value.find(
        k => k.public_key === pkECDSA.publicKey.toStringRaw(),
      );

      if (keyPairED25519) {
        await safeAwait(updateKeyPairsHash(keyPairED25519, i));
        totalRef.value++;
        count++;
      }
      if (keyPairECDSA) {
        await safeAwait(updateKeyPairsHash(keyPairECDSA, i));
        totalRef.value++;
        count++;
      }
    }

    await user.refetchUserState();
    await keys.refetchKeys();

    return count;
  };

  const updateKeyPairsHash = async (localKeyPair: KeyPair, index: number): Promise<void> => {
    if (!keys.recoveryPhrase) {
      return;
    }

    if (isLoggedInOrganization(user.selectedOrganization)) {
      const organizationKeyPair = user.selectedOrganization.userKeys.find(
        key => key.publicKey === localKeyPair.public_key,
      );
      if (organizationKeyPair) {
        await updateOrganizationKey(
          user.selectedOrganization.serverUrl,
          user.selectedOrganization.userId,
          organizationKeyPair.id,
          keys.recoveryPhrase.hash,
          index,
        );
      }
    }
    await updateLocalMnemonicHash(localKeyPair.id, keys.recoveryPhrase.hash);
    await updateIndex(localKeyPair.id, index);
  };

  return {
    externalKeys,
    startMatching,
    updateKeyPairsHash,
  };
}
