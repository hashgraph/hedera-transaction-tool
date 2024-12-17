import { safeStorage } from 'electron';

import { KeyPair, Prisma } from '@prisma/client';

import { encrypt, decrypt } from '@main/utils/crypto';

import { getPrismaClient } from '@main/db/prisma';

import { getCurrentUser, getOrganization } from '.';
import { getUseKeychainClaim } from './claim';

//Get all stored secret hash objects
export const getSecretHashes = async (
  user_id: string,
  organization_id?: string | null,
): Promise<string[]> => {
  const prisma = getPrismaClient();

  const where: Prisma.KeyPairWhereInput = {
    user_id,
    secret_hash: {
      not: null,
    },
  };

  await extendWhere(where, organization_id);

  const groups = await prisma.keyPair.groupBy({
    by: ['secret_hash'],
    where,
  });

  return groups.map(gr => gr.secret_hash).filter(sh => sh !== null) as string[];
};

//Get stored key pairs
export const getKeyPairs = async (
  user_id: string,
  organization_id?: string | null,
): Promise<KeyPair[]> => {
  const prisma = getPrismaClient();

  const where: Prisma.KeyPairWhereInput = {
    user_id,
  };

  await extendWhere(where, organization_id);

  return prisma.keyPair.findMany({
    where,
    orderBy: {
      secret_hash: 'desc',
    },
  });
};

// Store key pair
export const storeKeyPair = async (
  keyPair: Prisma.KeyPairUncheckedCreateInput,
  password: string | null,
  encrypted: boolean,
) => {
  const prisma = getPrismaClient();

  try {
    if (!encrypted) {
      const useKeychain = await getUseKeychainClaim();

      if (useKeychain) {
        const buffer = safeStorage.encryptString(keyPair.private_key);
        keyPair.private_key = buffer.toString('base64');
      } else if (password) {
        keyPair.private_key = encrypt(keyPair.private_key, password);
      } else {
        throw new Error('Password is required to store unencrypted key pair');
      }
    }
    await prisma.keyPair.create({
      data: keyPair,
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
export const decryptPrivateKey = async (
  user_id: string,
  password: string | null,
  public_key: string,
) => {
  const prisma = getPrismaClient();

  const keyPair = await prisma.keyPair.findFirst({
    where: {
      user_id,
      public_key,
    },
    select: {
      private_key: true,
    },
  });

  const useKeychain = await getUseKeychainClaim();

  if (useKeychain) {
    const buffer = Buffer.from(keyPair?.private_key || '', 'base64');
    return safeStorage.decryptString(buffer);
  }

  if (!password) {
    throw new Error('Password is required to decrypt private key');
  }

  return decrypt(keyPair?.private_key || '', password);
};

// Delete encrypted private keys
export const deleteEncryptedPrivateKeys = async (
  user_id: string,
  organization_id?: string | null,
) => {
  const prisma = getPrismaClient();

  const where: Prisma.KeyPairWhereInput = {
    user_id,
  };

  await extendWhere(where, organization_id);

  await prisma.keyPair.updateMany({
    where,
    data: {
      private_key: '',
    },
  });
};

// Clear user's keys
export const deleteSecretHashes = async (user_id: string, organization_id?: string | null) => {
  const prisma = getPrismaClient();

  const where: Prisma.KeyPairWhereInput = {
    user_id,
  };

  await extendWhere(where, organization_id);

  await prisma.keyPair.deleteMany({
    where,
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

// Update key pair nickname
export const updateNickname = async (keyPairId: string, nickname: string) => {
  const prisma = getPrismaClient();

  await prisma.keyPair.update({
    where: {
      id: keyPairId,
    },
    data: {
      nickname,
    },
  });
};

// Update key pair mnemonic hash
export const updateMnemonicHash = async (keyPairId: string, secret_hash: string) => {
  const prisma = getPrismaClient();

  await prisma.keyPair.update({
    where: {
      id: keyPairId,
    },
    data: {
      secret_hash,
    },
  });
};

async function extendWhere(where: Prisma.KeyPairWhereInput, organization_id?: string | null) {
  if (organization_id !== undefined) {
    if (organization_id === null) {
      where.organization_id = null;
      return;
    }

    const organization = await getOrganization(organization_id);

    if (organization) {
      const tokenPayload = await getCurrentUser(organization.serverUrl);

      where.organization_id = organization.id;

      if (tokenPayload && tokenPayload.userId && !isNaN(tokenPayload.userId)) {
        where.organization_user_id = parseInt(tokenPayload.userId);
      } else where.organization_id = null;
    } else where.organization_id = null;
  }
}
