import { EntityManager } from 'typeorm';

import { User, UserKey } from '@app/common/database/entities';

export const attachKeys = async (
  user: User,
  entityManager: EntityManager,
) => {
  if (!user.keys || user.keys.length === 0) {
    user.keys = await entityManager.find(UserKey, {
      where: { userId: user.id },
    });
  }
};

/**
 * Type for UserKey with user relation loaded (user may be null if deleted/unloaded).
 */
export type UserKeyWithUser = UserKey & { user: User | null };

/**
 * Checks if a UserKey is active (not soft-deleted, has user, user not soft-deleted).
 */
export const isActiveUserKey = (key: UserKeyWithUser): boolean => {
  return !key.deletedAt && key.user !== null && !key.user.deletedAt;
};

/**
 * Filters array to return only active UserKeys.
 */
export const filterActiveUserKeys = <T extends UserKeyWithUser>(keys: T[]): T[] => {
  return keys.filter(isActiveUserKey);
};
