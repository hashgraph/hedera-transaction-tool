import type { Mnemonic } from '@prisma/client';

import { Prisma } from '@prisma/client';

import { commonIPCHandler } from '@renderer/utils';

export const add = async (userId: string, mnemonicHash: string, nickname: string) =>
  commonIPCHandler<Mnemonic>(async () => {
    return await window.electronAPI.local.mnemonic.add(userId, mnemonicHash, nickname);
  }, 'Failed to add mnemonic');

export const get = async (findArgs: Prisma.MnemonicFindManyArgs) =>
  commonIPCHandler<Mnemonic[]>(async () => {
    return await window.electronAPI.local.mnemonic.get(findArgs);
  }, 'Failed to get mnemonics');

export const update = async (userId: string, mnemonicHash: string, nickname: string) =>
  commonIPCHandler<Mnemonic>(async () => {
    return await window.electronAPI.local.mnemonic.update(userId, mnemonicHash, nickname);
  }, 'Failed to update mnemonic');

export const remove = async (userId: string, mnemonicHashes: string[]) =>
  commonIPCHandler<boolean>(async () => {
    return await window.electronAPI.local.mnemonic.remove(userId, mnemonicHashes);
  }, 'Failed to remove mnemonics');

export const getStoredMnemonicNickname = async (
  userId: string | undefined,
  mnemonicHash: string,
): Promise<string | undefined> => {
  const where: Prisma.MnemonicWhereInput = { mnemonicHash };
  if (userId) {
    where['user_id'] = userId;
  }
  const [mnemonic] = await get({
    where,
  });

  return mnemonic?.nickname;
};
