import { queryPostgresDatabase } from './databaseUtil.js';

/**
 * Retrieves the index-0 public key for an organization user identified by email.
 *
 * @param email - The organization user email.
 * @returns The public key string if found, otherwise `null`.
 */
export async function getFirstPublicKeyByEmail(email: string) {
  const query = `
    SELECT uk."publicKey"
    FROM public."user" u
    JOIN public.user_key uk ON u.id = uk."userId"
    WHERE u.email = $1 AND uk.index = 0;
  `;

  try {
    const result = await queryPostgresDatabase(query, [email]);
    return result[0]?.publicKey || null;
  } catch (error) {
    console.error('Error fetching public key by email:', error);
    return null;
  }
}

/**
 * Retrieves all public keys for an organization user identified by email.
 *
 * @param email - The organization user email.
 * @returns An array of public key strings; empty when no keys are found.
 */
export async function getAllPublicKeysByEmail(email: string) {
  const query = `
    SELECT "publicKey"
    FROM public.user_key
    WHERE "userId" = (
      SELECT id
      FROM public."user"
      WHERE email = $1
    );
  `;

  try {
    const result = await queryPostgresDatabase<{ publicKey: string }>(query, [email]);
    return result.map(row => row.publicKey);
  } catch (error) {
    console.error('Error fetching public keys by email:', error);
    return [];
  }
}

/**
 * Retrieves the organization user ID for the user identified by email.
 *
 * @param email - The organization user email.
 * @returns The user ID if found, otherwise `null`.
 */
export async function getUserIdByEmail(email: string) {
  const query = `
    SELECT id
    FROM public."user"
    WHERE email = $1;
  `;

  try {
    const result = await queryPostgresDatabase(query, [email]);
    return result[0]?.id || null;
  } catch (error) {
    console.error('Error fetching user ID by email:', error);
    return null;
  }
}

/**
 * Deletes all `user_key` rows for the organization user identified by email.
 *
 * @param email - The organization user email.
 * @returns The number of deleted rows.
 */
export async function deleteUserKeysByEmail(email: string): Promise<number> {
  const query = `
    DELETE FROM public.user_key
    WHERE "userId" = (
      SELECT id
      FROM public."user"
      WHERE email = $1
    )
    RETURNING id;
  `;

  try {
    const deleted = await queryPostgresDatabase<{ id: number }>(query, [email]);
    return deleted.length;
  } catch (error) {
    console.error('Error deleting user keys by email:', error);
    return 0;
  }
}

/**
 * Deletes every row in the `user_key` table.
 *
 * @returns The number of deleted rows.
 */
export async function deleteAllUserKeys(): Promise<number> {
  const query = `
    DELETE FROM public.user_key
    RETURNING id;
  `;

  try {
    const deleted = await queryPostgresDatabase<{ id: number }>(query);
    return deleted.length;
  } catch (error) {
    console.error('Error deleting all user keys:', error);
    return 0;
  }
}

/**
 * Clears mnemonic hashes for active organization user keys identified by email.
 *
 * Forces the recovery flow to trigger while keeping existing key rows intact for
 * later assertions.
 *
 * @param email - The organization user email.
 * @returns The number of updated rows.
 */
export async function clearUserKeyMnemonicHashesByEmail(email: string): Promise<number> {
  const query = `
    UPDATE public.user_key
    SET "mnemonicHash" = NULL
    WHERE "userId" = (
      SELECT id
      FROM public."user"
      WHERE email = $1
    )
      AND "deletedAt" IS NULL
    RETURNING id;
  `;

  try {
    const updated = await queryPostgresDatabase<{ id: number }>(query, [email]);
    return updated.length;
  } catch (error) {
    console.error('Error clearing user key mnemonic hashes by email:', error);
    return 0;
  }
}

/**
 * Sets the mnemonic hash on every active organization user key for the given email.
 *
 * @param email - The organization user email.
 * @param mnemonicHash - The mnemonic hash to store.
 * @returns The number of updated rows.
 */
export async function setUserKeyMnemonicHashesByEmail(
  email: string,
  mnemonicHash: string,
): Promise<number> {
  const query = `
    UPDATE public.user_key
    SET "mnemonicHash" = $2
    WHERE "userId" = (
      SELECT id
      FROM public."user"
      WHERE email = $1
    )
      AND "deletedAt" IS NULL
    RETURNING id;
  `;

  try {
    const updated = await queryPostgresDatabase<{ id: number }>(query, [email, mnemonicHash]);
    return updated.length;
  } catch (error) {
    console.error('Error setting user key mnemonic hashes by email:', error);
    return 0;
  }
}

/**
 * Checks whether the user_key row with the given public key has been soft-deleted.
 *
 * @param publicKey - The public key to check.
 * @returns `true` if the row's `deletedAt` is non-null, otherwise `false`.
 */
export async function isKeyDeleted(publicKey: string) {
  const checkDeletionQuery = `
    SELECT "deletedAt"
    FROM public.user_key
    WHERE "publicKey" = $1;
  `;

  try {
    const deletionResult = await queryPostgresDatabase<{ deletedAt: Date | null }>(
      checkDeletionQuery,
      [publicKey],
    );
    if (!deletionResult[0]) return false;
    return deletionResult[0].deletedAt !== null;
  } catch (error) {
    console.error('Error checking if key is deleted:', error);
    return false;
  }
}

/**
 * Checks whether a fresh index-0 (non-deleted) key exists for the given organization user.
 *
 * @param userId - The organization user ID.
 * @returns `true` if such a key exists, otherwise `false`.
 */
export async function findNewKey(userId: number) {
  const findNewKeyQuery = `
    SELECT "publicKey"
    FROM public.user_key
    WHERE "userId" = $1 AND index = 0 AND "deletedAt" IS NULL;
  `;

  try {
    const newKeyResult = await queryPostgresDatabase(findNewKeyQuery, [userId]);
    return newKeyResult.length > 0;
  } catch (error) {
    console.error('Error finding new key for user:', error);
    return false;
  }
}

/**
 * Retrieves all transaction IDs the given user is observing.
 *
 * @param userId - The organization user ID acting as observer.
 * @returns An array of SDK transaction IDs; empty when none are found.
 */
export async function getAllTransactionIdsForUserObserver(userId: number) {
  const query = `
    SELECT t."transactionId"
    FROM public.transaction t
    INNER JOIN public.transaction_observer tobs ON t.id = tobs."transactionId"
    WHERE tobs."userId" = $1;
  `;

  try {
    const result = await queryPostgresDatabase<{ transactionId: string }>(query, [userId]);
    return result.map(row => row.transactionId);
  } catch (error) {
    console.error('Error fetching transaction IDs for user observer:', error);
    return [];
  }
}

/**
 * Promotes the user identified by email to an organization admin.
 *
 * @param email - The organization user email.
 * @returns `true` if the update succeeded, otherwise `false`.
 */
export async function upgradeUserToAdmin(email: string) {
  const query = `
    UPDATE public."user"
    SET admin = true, "updatedAt" = now()
    WHERE email = $1
    RETURNING 1;
  `;

  try {
    const result = await queryPostgresDatabase<{ '?column?': number }>(query, [email]);
    return result.length > 0;
  } catch (error) {
    console.error('Error upgrading user to admin:', error);
    return false;
  }
}

/**
 * Checks whether the user identified by email is flagged as an organization admin.
 *
 * @param email - The organization user email.
 * @returns `true` if the user has the admin flag set, otherwise `false`.
 */
export async function isUserAdmin(email: string): Promise<boolean> {
  const query = `
    SELECT admin
    FROM public."user"
    WHERE email = $1
    LIMIT 1;
  `;

  try {
    const result = await queryPostgresDatabase<{ admin: boolean }>(query, [email]);
    return result.length > 0 ? Boolean(result[0].admin) : false;
  } catch (error) {
    console.error('Error checking admin flag for user:', error);
    return false;
  }
}

/**
 * Verifies if a user with the given email exists in the organization Postgres `user` table.
 *
 * @param email - The organization user email.
 * @returns `true` if a matching user row exists, otherwise `false`.
 */
export async function verifyUserExistsInOrganization(email: string) {
  const query = `
      SELECT COUNT(*) AS count
      FROM public."user"
      WHERE email = $1
  `;

  try {
    const result = await queryPostgresDatabase<{ count: number }>(query, [email]);
    return result[0]?.count > 0;
  } catch (error) {
    console.error('Error verifying user:', error);
    return false;
  }
}

/**
 * Checks whether the organization user identified by email has been soft-deleted.
 *
 * @param email - The organization user email.
 * @returns `true` if `deletedAt` is non-null, otherwise `false`.
 */
export async function isUserDeleted(email: string) {
  const query = `
    SELECT "deletedAt"
    FROM public."user"
    WHERE email = $1;
  `;

  try {
    const result = await queryPostgresDatabase<{ deletedAt: string | null }>(query, [email]);
    if (result.length === 0) return false;
    return result[0].deletedAt !== null;
  } catch (error) {
    console.error('Error checking if user is deleted:', error);
    return false;
  }
}

/**
 * Inserts a row into `user_key` for the given organization user.
 *
 * @param userId - The organization user ID.
 * @param mnemonicHash - The hashed mnemonic phrase.
 * @param index - The key index (typically 0).
 * @param publicKey - The public key derived from the mnemonic.
 * @returns The inserted row's ID, or `null` on failure.
 */
export async function insertUserKey(
  userId: number,
  mnemonicHash: string,
  index: number,
  publicKey: string,
) {
  const query = `
    INSERT INTO public.user_key ("userId", "mnemonicHash", "index", "publicKey")
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `;

  try {
    const result = await queryPostgresDatabase<{ id: number }>(query, [
      userId,
      mnemonicHash,
      index,
      publicKey,
    ]);
    return result[0]?.id || null;
  } catch (error) {
    console.error('Error inserting user key:', error);
    return null;
  }
}

/**
 * Retrieves the `id` column of every row in the organization `user` table.
 *
 * @returns An array of raw rows containing the `id` field.
 */
export async function getUserIds() {
  const query = 'SELECT id FROM public."user"';
  return await queryPostgresDatabase(query);
}