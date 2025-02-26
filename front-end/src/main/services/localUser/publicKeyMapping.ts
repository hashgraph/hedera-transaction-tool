import { PublicKeyMapping } from '@prisma/client';

import { getPrismaClient } from '@main/db/prisma';

//Get stored public keys
export const getPublicKeys = async (): Promise<PublicKeyMapping[]> => {
  const prisma = getPrismaClient();
  return prisma.publicKeyMapping.findMany();
};

//add new public key
export const addPublicKey = async (
  publicKey: string,
  nickname: string,
): Promise<PublicKeyMapping> => {
  const prisma = getPrismaClient();

  return prisma.publicKeyMapping.create({
    data: {
      public_key: publicKey,
      nickname: nickname,
    },
  });
};

// get a single public key mapping
export const getPublicKey = async (publicKey: string): Promise<PublicKeyMapping | null> => {
  const prisma = getPrismaClient();

  return prisma.publicKeyMapping.findUnique({
    where: { public_key: publicKey },
  });
};

//Edit nickname
export const updatePublicKeyNickname = async (
  publicKey: string,
  newNickname: string,
): Promise<PublicKeyMapping | null> => {
  const prisma = getPrismaClient();

  return prisma.publicKeyMapping.update({
    where: { public_key: publicKey },
    data: { nickname: newNickname },
  });
};

//Delete stored public key mapping
export const deletePublicKey = async (publicKey: string): Promise<PublicKeyMapping | null> => {
  const prisma = getPrismaClient();

  return prisma.publicKeyMapping.delete({
    where: { public_key: publicKey },
  });
};
