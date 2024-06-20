import { Prisma } from '@prisma/client';
import { commonIPCHandler } from '@renderer/utils';

export const addLinkedPublicKey = async (
  user_id: string,
  publicKey: Prisma.PublicKeyLinkedUncheckedCreateInput,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.linkedPublicKeys.createContactPublicKey(
      user_id,
      publicKey,
    );
  }, 'Contact add failed');

export const getLinkedPublicKeys = (userId: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.linkedPublicKeys.getLinkedPublicKeys(userId);
  }, 'Failed to get linked public keys');

export const deleteLinkedPublicKey = (id: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.linkedPublicKeys.deleteLinkedPublicKey(id);
  }, 'Failed to delete linked public key');
