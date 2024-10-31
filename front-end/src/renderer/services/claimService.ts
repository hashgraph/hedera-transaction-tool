import type { Claim } from '@prisma/client';

import { Prisma } from '@prisma/client';

import { commonIPCHandler } from '@renderer/utils';

export const add = async (userId: string, claimKey: string, claimValue: string) =>
  commonIPCHandler<Claim>(async () => {
    return await window.electronAPI.local.claim.add(userId, claimKey, claimValue);
  }, 'Failed to add claim');

export const get = async (findArgs: Prisma.ClaimFindManyArgs) =>
  commonIPCHandler<Claim[]>(async () => {
    return await window.electronAPI.local.claim.get(findArgs);
  }, 'Failed to get claims');

export const update = async (userId: string, claimKey: string, claimValue: string) =>
  commonIPCHandler<Claim>(async () => {
    return await window.electronAPI.local.claim.update(userId, claimKey, claimValue);
  }, 'Failed to update claim');

export const remove = async (userId: string, claimKeys: string[]) =>
  commonIPCHandler<boolean>(async () => {
    return await window.electronAPI.local.claim.remove(userId, claimKeys);
  }, 'Failed to remove claim');

export const getStoredClaim = async (
  userId: string | undefined,
  key: string,
): Promise<string | undefined> => {
  const where: Prisma.ClaimWhereInput = { claim_key: key };
  if (userId) {
    where['user_id'] = userId;
  }
  const [claim] = await get({
    where,
  });

  return claim?.claim_value;
};
