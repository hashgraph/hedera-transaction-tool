import * as fsp from 'fs/promises';
import * as path from 'path';

import { abortFileSearch, searchFiles } from '@main/utils/files';
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
  id: string,
  newNickname: string,
): Promise<PublicKeyMapping | null> => {
  const prisma = getPrismaClient();

  return prisma.publicKeyMapping.update({
    where: { id: id },
    data: { nickname: newNickname },
  });
};

//Delete stored public key mapping
export const deletePublicKey = async (id: string): Promise<PublicKeyMapping | null> => {
  const prisma = getPrismaClient();

  return prisma.publicKeyMapping.delete({
    where: { id: id },
  });
};

/* Searches for `.pub` public key files in the given paths */
export const searchPublicKeys = async (filePaths: string[]) => {
  const processFile = async (filePath: string) => {
    const publicKeyContent = await fsp.readFile(filePath, 'utf-8');
    const nickname = path.basename(filePath, '.pub');
    return { publicKey: publicKeyContent.trim(), nickname };
  }

  return await searchFiles(filePaths, ['.pub'], processFile);
}

export const abortPublicKeySearch = () => {
  abortFileSearch();
}
