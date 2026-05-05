/**
 * Aggregated database query helpers for the automation suite.
 *
 * The implementations live in three thematic modules:
 *   - `localQueries.ts`        — local SQLite (Transaction, HederaAccount, HederaFile,
 *                                User, KeyPair, Organization, GroupItem)
 *   - `userQueries.ts`         — Postgres `user` / `user_key` / observer / admin helpers
 *   - `notificationQueries.ts` — Postgres notification preference and receiver helpers
 *
 * This barrel re-exports them so callers can keep importing from
 * `utils/db/databaseQueries.js` without caring which module owns each function.
 */

export {
  deleteAccountById,
  getKeyPairByIndexAndEmail,
  getPublicKeyByEmail,
  getTransactionGroupsForTransactionId,
  insertKeyPair,
  updateLocalFileMetadata,
  updateLocalTransactionStatus,
  verifyAccountExists,
  verifyFileExists,
  verifyOrganizationExists,
  verifyPrivateKeyExistsByEmail,
  verifyPublicKeyExistsByEmail,
  verifyTransactionExists,
  verifyUserExists,
} from './localQueries.js';

export {
  clearUserKeyMnemonicHashesByEmail,
  deleteAllUserKeys,
  deleteUserKeysByEmail,
  findNewKey,
  getAllPublicKeysByEmail,
  getAllTransactionIdsForUserObserver,
  getFirstPublicKeyByEmail,
  getUserIdByEmail,
  getUserIds,
  insertUserKey,
  isKeyDeleted,
  isUserAdmin,
  isUserDeleted,
  setUserKeyMnemonicHashesByEmail,
  upgradeUserToAdmin,
  verifyUserExistsInOrganization,
} from './userQueries.js';

export {
  disableNotificationPreferences,
  disableNotificationsForUsers,
  ensureNotificationTypesForUsers,
  getInAppNotificationStatusByEmailAndTransactionId,
  getNotifiedTransactionIdByEmail,
} from './notificationQueries.js';