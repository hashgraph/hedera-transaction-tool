import { getPrismaClient } from '@main/db';
import { Prisma } from '@prisma/client';

export const getComplexKeys = (userId: string) => {
  const prisma = getPrismaClient();

  try {
    return prisma.complexKey.findMany({
      where: {
        user_id: userId,
      },
    });
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const complexKeyExists = async (userId: string, protobufEncoded: string) => {
  const prisma = getPrismaClient();

  const count = await prisma.complexKey.count({
    where: {
      user_id: userId,
      protobufEncoded,
    },
  });

  return count > 0;
};

export const addComplexKey = async (complexKey: Prisma.ComplexKeyUncheckedCreateInput) => {
  const prisma = getPrismaClient();

  const exists = await complexKeyExists(complexKey.user_id, complexKey.protobufEncoded);

  if (exists) {
    throw new Error('Complex key already exists!');
  }

  await prisma.complexKey.create({
    data: complexKey,
  });

  return await getComplexKeys(complexKey.user_id);
};

export const removeComplexKey = async (userId: string, protobufEncoded: string) => {
  const prisma = getPrismaClient();

  const exists = await complexKeyExists(userId, protobufEncoded);

  if (!exists) {
    throw new Error(`Complex key not found!`);
  }

  await prisma.complexKey.deleteMany({
    where: {
      user_id: userId,
      protobufEncoded,
    },
  });

  return await getComplexKeys(userId);
};

export const updateComplexKey = async (
  userId: string,
  oldProtobufEncoded: string,
  newProtobufEncoded: string,
) => {
  const prisma = getPrismaClient();

  await prisma.complexKey.updateMany({
    where: {
      user_id: userId,
      protobufEncoded: oldProtobufEncoded,
    },
    data: {
      protobufEncoded: newProtobufEncoded,
    },
  });

  return await getComplexKeys(userId);
};
