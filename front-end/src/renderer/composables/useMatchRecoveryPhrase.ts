import type { KeyPair } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

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

  /* Computed */
  const externalKeys = computed(() => user.keyPairs.filter(k => !k.secret_hash));

  /* Functions */
  const startMatching = async (
    startIndex: number,
    endIndex: number,
    abortController: AbortController,
    totalRef: Ref<number>,
  ) => {
    if (!user.recoveryPhrase) {
      throw new Error('Recovery phrase is not set');
    }

    let count = 0;

    for (let i = startIndex; i <= endIndex; i++) {
      if (abortController.signal.aborted || externalKeys.value.length === count) {
        break;
      }

      const pkED25519 = await restorePrivateKey(user.recoveryPhrase.words, '', i, 'ED25519');
      const pkECDSA = await restorePrivateKey(user.recoveryPhrase.words, '', i, 'ECDSA');

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
    await user.refetchKeys();

    return count;
  };

  const updateKeyPairsHash = async (localKeyPair: KeyPair, index: number): Promise<void> => {
    if (!user.recoveryPhrase) {
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
          user.recoveryPhrase.hash,
          index,
        );
      }
    }
    await updateLocalMnemonicHash(localKeyPair.id, user.recoveryPhrase.hash);
    await updateIndex(localKeyPair.id, index);
  };

  return {
    externalKeys,
    startMatching,
    updateKeyPairsHash,
  };
}
