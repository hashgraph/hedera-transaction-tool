import type { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';

import {
  assertUserLoggedIn,
  isLoggedInOrganization,
  safeAwait,
  safeDuplicateUploadKey,
} from '@renderer/utils';

/**
 * Stores a key pair that has no recovery phrase (generated at random or pasted),
 * uploading its public key to the selected organization if there is one.
 */
export default function useStoreExternalKeyPair() {
  const user = useUserStore();
  const contacts = useContactsStore();

  return async (
    key: { public_key: string; private_key: string; nickname: string | null; index: number },
    type: 'ED25519' | 'ECDSA',
    personalPassword: string | null,
  ) => {
    assertUserLoggedIn(user.personal);

    const keyPair: Prisma.KeyPairUncheckedCreateInput = {
      user_id: user.personal.id,
      ...key,
      organization_id: null,
      organization_user_id: null,
      type,
      secret_hash: null,
    };

    if (user.keyPairs.find(kp => kp.public_key === keyPair.public_key)) {
      throw new Error('Key pair already exists');
    }

    if (isLoggedInOrganization(user.selectedOrganization)) {
      keyPair.organization_id = user.selectedOrganization.id;
      keyPair.organization_user_id = user.selectedOrganization.userId;

      await safeDuplicateUploadKey(user.selectedOrganization, {
        publicKey: keyPair.public_key,
      });
    }

    await user.storeKey(keyPair, null, personalPassword, false);
    await user.refetchUserState();
    await safeAwait(contacts.fetch());
  };
}
