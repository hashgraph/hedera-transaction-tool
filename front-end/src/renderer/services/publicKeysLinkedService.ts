import { Prisma } from '@prisma/client';
import { getMessageFromIPCError } from '@renderer/utils';

export const addLinkedPublicKey = async (
  user_id: string,
  publicKey: Prisma.PublicKeyLinkedUncheckedCreateInput,
) => {
  try {
    return await window.electronAPI.local.linkedPublicKeys.createContactPublicKey(
      user_id,
      publicKey,
    );
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Contact add failed'));
  }
};

export async function getLinkedPublicKeys(userId: string) {
  try {
    return await window.electronAPI.local.linkedPublicKeys.getLinkedPublicKeys(userId);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to get linked public keys'));
  }
}

export async function deleteLinkedPublicKey(id: string) {
  try {
    return await window.electronAPI.local.linkedPublicKeys.deleteLinkedPublicKey(id);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to delete linked public key'));
  }
}
