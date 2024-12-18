import { Mnemonic, Prisma } from '@prisma/client';

import { getPrismaClient } from '@main/db/prisma';

/* Add a mnemonic to the database */
export const addMnemonic = async (
  userId: string,
  mnemonicHash: string,
  nickname: string,
): Promise<Mnemonic> => {
  const prisma = getPrismaClient();

  const alreadyAddedCount = await prisma.mnemonic.count({
    where: { user_id: userId, mnemonicHash },
  });

  if (alreadyAddedCount > 0) throw new Error('Mnemonic already exists!');

  return await prisma.mnemonic.create({
    data: { user_id: userId, mnemonicHash, nickname },
  });
};

/* Get mnemonics from the database */
export const getMnemonics = async (findArgs: Prisma.MnemonicFindManyArgs): Promise<Mnemonic[]> => {
  const prisma = getPrismaClient();

  try {
    return await prisma.mnemonic.findMany(findArgs);
  } catch (error) {
    console.log(error);
    return [];
  }
};

/* Update a mnemonic in the database */
export const updateMnemonic = async (
  userId: string,
  mnemonicHash: string,
  nickname: string,
): Promise<Mnemonic> => {
  const prisma = getPrismaClient();

  const mnemonic = await prisma.mnemonic.findFirst({
    where: { user_id: userId, mnemonicHash },
  });

  if (!mnemonic) throw new Error('Mnemonic does not exist!');

  return await prisma.mnemonic.update({
    where: { id: mnemonic.id },
    data: { nickname },
  });
};

/* Remove mnemonics from the database */
export const removeMnemonics = async (
  userId: string,
  mnemonicHashes: string[],
): Promise<boolean> => {
  const prisma = getPrismaClient();

  await prisma.mnemonic.deleteMany({
    where: {
      user_id: userId,
      mnemonicHash: { in: mnemonicHashes },
    },
  });

  return true;
};
