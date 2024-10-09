import { getPrismaClient } from '@main/db/prisma';

export const getComplexKeys = async (userId: string) => {
  const prisma = getPrismaClient();

  try {
    const complexKeys = await prisma.complexKey.findMany({
      where: {
        user_id: userId,
      },
    });

    complexKeys.forEach(key => {
      key.protobufEncoded = Uint8Array.from(Buffer.from(key.protobufEncoded, 'hex')).toString();
    });

    return complexKeys;
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const getComplexKey = async (userId: string, keyListBytes: Uint8Array) => {
  const prisma = getPrismaClient();

  const protobufEncoded = Buffer.from(keyListBytes).toString('hex');

  const key = await prisma.complexKey.findFirst({
    where: {
      user_id: userId,
      protobufEncoded,
    },
  });

  if (!key) {
    return null;
  }

  key.protobufEncoded = Uint8Array.from(Buffer.from(key.protobufEncoded, 'hex')).toString();

  return key;
};

export const complexKeyExists = async (userId: string, keyListBytes: Uint8Array) => {
  const prisma = getPrismaClient();

  const protobufEncoded = Buffer.from(keyListBytes).toString('hex');

  const count = await prisma.complexKey.count({
    where: {
      user_id: userId,
      protobufEncoded,
    },
  });

  return count > 0;
};

export const addComplexKey = async (userId: string, keyListBytes: Uint8Array, nickname: string) => {
  const prisma = getPrismaClient();

  const protobufEncoded = Buffer.from(keyListBytes).toString('hex');

  const exists = await complexKeyExists(userId, keyListBytes);

  if (exists) {
    throw new Error('Complex key already exists!');
  }

  const newKey = await prisma.complexKey.create({
    data: {
      user_id: userId,
      protobufEncoded,
      nickname,
    },
  });
  newKey.protobufEncoded = Uint8Array.from(Buffer.from(newKey.protobufEncoded, 'hex')).toString();

  return newKey;
};

export const deleteComplexKey = async (id: string) => {
  const prisma = getPrismaClient();

  await prisma.complexKey.deleteMany({
    where: {
      id,
    },
  });
};

export const updateComplexKey = async (id: string, newKeyListBytes: Uint8Array) => {
  const prisma = getPrismaClient();

  const newProtobufEncoded = Buffer.from(newKeyListBytes).toString('hex');

  await prisma.complexKey.updateMany({
    where: {
      id,
    },
    data: {
      protobufEncoded: newProtobufEncoded,
    },
  });

  const updateKey = await prisma.complexKey.findFirst({ where: { id } });

  if (!updateKey) {
    throw new Error('Complex key not found!');
  }

  updateKey.protobufEncoded = Uint8Array.from(
    Buffer.from(updateKey.protobufEncoded, 'hex'),
  ).toString();

  return updateKey;
};
