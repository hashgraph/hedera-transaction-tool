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

/**
 * Single source of truth for "can this user have/use a report API key":
 * admins and anyone granted canViewReports. Shared by key issuance
 * (ApiKeysService), key authentication (ApiKeysService.validateApiKey),
 * the report-access route guard (ReportAccessGuard), and the
 * permission-removal cascade (UsersController.updateUser) so the rule can't
 * drift between those call sites.
 */
export const isEligibleForReportAccess = (
  user: Pick<User, 'admin' | 'canViewReports'>,
): boolean => {
  return user.admin || user.canViewReports;
};
