import { Claim, Prisma } from '@prisma/client';

import { STATIC_USER, USE_KEYCHAIN } from '@shared/constants';

import { getPrismaClient } from '@main/db/prisma';
import { createLogger } from '@main/modules/logger';

const logger = createLogger('main.localUser.claim');

/* Add a claim to the database */
export const addClaim = async (
  userId: string,
  claimKey: string,
  claimValue: string,
): Promise<Claim> => {
  assertMutableClaim(claimKey);
  const prisma = getPrismaClient();

  const alreadyAddedCount = await prisma.claim.count({
    where: {
      user_id: userId,
      claim_key: claimKey,
    },
  });

  if (alreadyAddedCount > 0) throw new Error('Claim already exists');

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
    logger.error('Failed to get claims', { error });
    return [];
  }
};

/* Update a claim in the database */
export const updateClaim = async (
  userId: string,
  claimKey: string,
  claimValue: string,
): Promise<Claim> => {
  assertMutableClaim(claimKey);
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

  claimKeys.forEach(assertMutableClaim);

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

/* Read the application's single, initialized encryption mode. */
export const getUseKeychainClaim = async () => {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { email: STATIC_USER } });
  const flag =
    user &&
    (await prisma.claim.findUnique({
      where: { user_id_claim_key: { user_id: user.id, claim_key: USE_KEYCHAIN } },
    }));
  if (!flag) throw new Error('Keychain mode not initialized');
  if (flag.claim_value !== 'true' && flag.claim_value !== 'false') {
    throw new Error('Invalid keychain mode');
  }
  return flag.claim_value === 'true';
};

const assertMutableClaim = (claimKey: string) => {
  if (claimKey === USE_KEYCHAIN) throw new Error('Security claims are immutable');
};
