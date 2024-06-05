import { getPrismaClient } from '@main/db/prisma';
import { Prisma } from '@prisma/client';

export const getLinkedPublicKeys = async (user_id: string) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.publicKeyLinked.findMany({
      where: {
        user_id,
      },
    });
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const createLinkedPublicKey = async (
  user_id: string,
  publicKey: Prisma.PublicKeyLinkedUncheckedCreateInput,
) => {
  const prisma = getPrismaClient();

  await prisma.publicKeyLinked.create({
    data: {
      ...publicKey,
      user_id,
    },
  });
};

export const deleteLinkedPublicKey = async (id: string) => {
  const prisma = getPrismaClient();

  await prisma.publicKeyLinked.delete({
    where: {
      id,
    },
  });
};
