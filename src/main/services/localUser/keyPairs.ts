import { KeyPair } from '@prisma/client';

import { encrypt, decrypt } from '@main/utils/crypto';

import { getPrismaClient } from '@main/db';

//Get all stored secret hash objects
export const getSecretHashes = async (
  userId: string,
  organizationId?: string,
): Promise<string[]> => {
  const prisma = getPrismaClient();

  const groups = await prisma.keyPair.groupBy({
    by: ['secret_hash'],
    where: {
      user_id: userId,
      organization_id: organizationId,
      secret_hash: {
        not: null,
      },
    },
  });

  return groups.map(gr => gr.secret_hash).filter(sh => sh !== null) as string[];
};

//Get stored key pairs
export const getKeyPairs = async (userId: string, organizationId?: string): Promise<KeyPair[]> => {
  const prisma = getPrismaClient();

  return prisma.keyPair.findMany({
    where: {
      AND: [{ user_id: userId }, { organization_id: organizationId }],
    },
    orderBy: {
      secret_hash: 'desc',
    },
  });
};

// Store key pair
export const storeKeyPair = async (keyPair: KeyPair, password: string) => {
  const prisma = getPrismaClient();

  try {
    keyPair.private_key = encrypt(keyPair.private_key, password);
    await prisma.keyPair.create({
      data: {
        ...keyPair,
        id: undefined,
      },
    });
  } catch (error: any) {
    console.log(error);
    throw new Error(error.message || 'Failed to store key pair');
  }
};

// Change decryption password
export const changeDecryptionPassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string,
) => {
  const prisma = getPrismaClient();

  const keyPairs = await getKeyPairs(userId);

  for (let i = 0; i < keyPairs.length; i++) {
    const keyPair = keyPairs[i];
    const decryptedPrivateKey = decrypt(keyPair.private_key, oldPassword);
    const encryptedPrivateKey = encrypt(decryptedPrivateKey, newPassword);

    await prisma.keyPair.update({
      where: {
        id: keyPair.id,
        public_key: keyPair.public_key,
      },
      data: {
        private_key: encryptedPrivateKey,
      },
    });
  }

  return await getKeyPairs(userId);
};

// Decrypt user's private key
export const decryptPrivateKey = async (userId: string, password: string, publicKey: string) => {
  const prisma = getPrismaClient();

  const keyPair = await prisma.keyPair.findFirst({
    where: {
      user_id: userId,
      public_key: publicKey,
    },
    select: {
      private_key: true,
    },
  });

  return decrypt(keyPair?.private_key, password);
};

// Delete encrypted private keys
export const deleteEncryptedPrivateKeys = async (userId: string, organizationId: string) => {
  const prisma = getPrismaClient();

  await prisma.keyPair.updateMany({
    where: {
      AND: [{ user_id: userId }, { organization_id: organizationId }],
    },
    data: {
      private_key: '',
    },
  });
};

// Clear user's keys
export const deleteSecretHashes = async (userId: string, organizationId?: string) => {
  const prisma = getPrismaClient();

  await prisma.keyPair.deleteMany({
    where: {
      AND: [{ user_id: userId }, { organization_id: organizationId }],
    },
  });
};

// Delete Key Pair
export const deleteKeyPair = async (keyPairId: string) => {
  const prisma = getPrismaClient();

  await prisma.keyPair.delete({
    where: {
      id: keyPairId,
    },
  });
};
