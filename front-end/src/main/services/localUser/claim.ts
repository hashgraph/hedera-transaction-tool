import { Claim, Prisma } from '@prisma/client';

import { USE_KEYCHAIN } from '@main/shared/constants';

import { getPrismaClient } from '@main/db/prisma';

/* Add a claim to the database */
export const addClaim = async (
  userId: string,
  claimKey: string,
  claimValue: string,
): Promise<Claim> => {
  const prisma = getPrismaClient();

  const alreadyAddedCount = await prisma.claim.count({
    where: {
      user_id: userId,
      claim_key: claimKey,
    },
  });

  if (alreadyAddedCount > 0) console.log('Claim already exists, claim will be overwritten');

  return await prisma.claim.create({
    data: {
      user_id: userId,
      claim_key: claimKey,
      claim_value: claimValue,
    },
  });
};

/* Get claims from the database */
export const getClaims = async (findArgs: Prisma.ClaimFindManyArgs): Promise<Claim[]> => {
  const prisma = getPrismaClient();

  try {
    return await prisma.claim.findMany(findArgs);
  } catch (error) {
    console.log(error);
    return [];
  }
};

/* Update a claim in the database */
export const updateClaim = async (
  userId: string,
  claimKey: string,
  claimValue: string,
): Promise<Claim> => {
  const prisma = getPrismaClient();

  const claim = await prisma.claim.findFirst({
    where: {
      user_id: userId,
      claim_key: claimKey,
    },
  });

  if (!claim) throw new Error('Claim does not exist!');

  return await prisma.claim.update({
    where: {
      id: claim.id,
    },
    data: {
      claim_value: claimValue,
    },
  });
};

/* Remove claims from the database */
export const removeClaims = async (userId: string, claimKeys: string[]): Promise<boolean> => {
  const prisma = getPrismaClient();

  await prisma.claim.deleteMany({
    where: {
      user_id: userId,
      claim_key: {
        in: claimKeys,
      },
    },
  });

  return true;
};

/* Get use key chain claim */
export const getUseKeychainClaim = async () => {
  const flags = await getClaims({
    where: {
      claim_key: USE_KEYCHAIN,
    },
  });
  if (flags.length === 0) throw new Error('Keychain mode not initialized');

  return flags[0].claim_value === 'true';
};
