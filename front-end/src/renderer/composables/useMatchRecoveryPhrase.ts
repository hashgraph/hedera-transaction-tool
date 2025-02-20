import type { KeyPair } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import {
  restorePrivateKey,
  updateMnemonicHash as updateLocalMnemonicHash,
} from '@renderer/services/keyPairService';
import { updateKey as updateOrganizationKey } from '@renderer/services/organization';

import { isLoggedInOrganization, isUserLoggedIn, safeAwait } from '@renderer/utils';

export default function useMatchRecoveryPrase() {
  /* Stores */
  const user = useUserStore();

  /* Functions */
  const getExternalKeys = async (): Promise<KeyPair[]> => {
    if (!isUserLoggedIn(user.personal)) {
      return [];
    }

    return user.keyPairs.filter(k => !k.secret_hash);
  };

  const startMatching = async (
    startIndex: number,
    endIndex: number,
    abortController: AbortController,
  ) => {
    if (!user.recoveryPhrase) {
      throw new Error('Recovery phrase is not set');
    }

    const externalKeys = await getExternalKeys();
    let count = 0;

    for (let i = startIndex; i <= endIndex; i++) {
      if (abortController.signal.aborted) {
        break;
      }

      const pkED25519 = await restorePrivateKey(user.recoveryPhrase.words, '', i, 'ED25519');
      const pkECDSA = await restorePrivateKey(user.recoveryPhrase.words, '', i, 'ECDSA');

      const keyPairED25519 = externalKeys.find(
        k => k.public_key === pkED25519.publicKey.toStringRaw(),
      );
      const keyPairECDSA = externalKeys.find(k => k.public_key === pkECDSA.publicKey.toStringRaw());

      if (keyPairED25519) {
        await safeAwait(updateKeyPairsHash(keyPairED25519));
        count++;
      }
      if (keyPairECDSA) {
        await safeAwait(updateKeyPairsHash(keyPairECDSA));
        count++;
      }
    }

    await user.refetchUserState();
    await user.refetchKeys();

    return count;
  };

  const updateKeyPairsHash = async (localKeyPair: KeyPair): Promise<void> => {
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
        );
      }
    }
    await updateLocalMnemonicHash(localKeyPair.id, user.recoveryPhrase.hash);
  };

  return {
    getExternalKeys,
    startMatching,
    updateKeyPairsHash,
  };
}
