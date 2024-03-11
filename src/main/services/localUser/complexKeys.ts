import { getPrismaClient } from '@main/db';

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

export const addComplexKey = async (userId: string, keyListBytes: Uint8Array, nickname: string) => {
  const prisma = getPrismaClient();

  const protobufEncoded = Buffer.from(keyListBytes).toString('hex');

  const exists = await complexKeyExists(userId, protobufEncoded);

  if (exists) {
    throw new Error('Complex key already exists!');
  }

  await prisma.complexKey.create({
    data: {
      user_id: userId,
      protobufEncoded,
      nickname,
    },
  });

  return await getComplexKeys(userId);
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
  oldKeyListBytes: Uint8Array,
  newKeyListBytes: Uint8Array,
) => {
  const prisma = getPrismaClient();

  const oldProtobufEncoded = Buffer.from(oldKeyListBytes).toString('hex');
  const newProtobufEncoded = Buffer.from(newKeyListBytes).toString('hex');

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
