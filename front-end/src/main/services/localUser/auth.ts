import { randomUUID } from 'crypto';

import { getPrismaClient } from '@main/db/prisma';
import { hash, dualCompareHash } from '@main/utils/crypto';

import { prepareKeyPairsReencryption } from './keyPairs';
import { prepareCredentialsReencryption } from './organizationCredentials';

export const register = async (email: string, password: string) => {
  const prisma = getPrismaClient();

  return await prisma.user.create({
    data: {
      id: randomUUID(),
      email: email,
      password: await hash(password),
    },
  });
};

export const login = async (email: string, password: string, _autoRegister?: boolean) => {
  const prisma = getPrismaClient();

  const user = await prisma.user.findFirst({
    where: {
      email,
    },
  });

  if (!user || email != user.email) {
    throw new Error('Incorrect email');
  }

  // if (autoRegister) {
  //   return await register(email, password);
  // } else if (email != firstUser.email) {
  //   throw new Error('Incorrect email');
  // }
  const { correct, isBcrypt } = await dualCompareHash(password, user.password);

  if (!correct) {
    throw new Error('Incorrect password');
  }

  /* Temporary to migrate users to new hashing algorithm */
  if (isBcrypt) {
    await rehashPassword(user.id, password);
  }

  return user;
};

export const deleteUser = async (email: string) => {
  const prisma = getPrismaClient();

  await prisma.user.delete({
    where: {
      email,
    },
  });
};

export const getUsersCount = async () => {
  const prisma = getPrismaClient();
  return await prisma.user.count();
};

export const comparePasswords = async (userId: string, password: string) => {
  const prisma = getPrismaClient();

  const firstUser = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!firstUser) {
    throw new Error('User not found');
  }

  const { correct } = await dualCompareHash(password, firstUser.password);
  return correct;
};

export const changePassword = async (userId: string, oldPassword: string, newPassword: string) => {
  const isOldCorrect = await comparePasswords(userId, oldPassword);

  if (!isOldCorrect) {
    throw new Error('Incorrect current password');
  }

  // Everything is re-encrypted in memory first, then the password hash and all re-encrypted
  // data are written in a single transaction, so a failure never leaves a mix of old and new.
  const keyPairUpdates = await prepareKeyPairsReencryption(userId, oldPassword, newPassword);
  const credentialUpdates = await prepareCredentialsReencryption(userId, oldPassword, newPassword);
  const hashedPassword = await hash(newPassword);

  const prisma = getPrismaClient();
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } }),
    ...keyPairUpdates.map(update => prisma.keyPair.update(update)),
    ...credentialUpdates.map(update => prisma.organizationCredentials.update(update)),
  ]);
};

/*
 * Re-stores the login hash of a password the user has just been verified with (used to migrate
 * legacy bcrypt hashes to argon2). It does NOT change the password: the plaintext stays the same,
 * so data encrypted with it (key pairs, organization credentials) remains decryptable.
 *
 * Do not use this to change a user's password. That changes the encryption key, so all data
 * encrypted with the old password must be re-encrypted in the same transaction as the new hash,
 * as done in changePassword().
 */
const rehashPassword = async (id: string, password: string) => {
  await getPrismaClient().user.update({
    where: {
      id,
    },
    data: {
      password: await hash(password),
    },
  });
};
