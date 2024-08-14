const { queryPostgresDatabase, queryDatabase } = require('./databaseUtil');

/**
 * Retrieves the public key for a user identified by the given email.
 *
 * @param {string} email - The email of the user whose public key is to be retrieved.
 * @return {Promise<string|null>} A promise that resolves to the public key if found, or null if not found.
 * @throws {Error} If there is an error executing the query.
 */
async function getFirstPublicKeyByEmail(email) {
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
 * Retrieves all public keys for a user identified by the given email.
 * @param email - The email of the user whose public keys are to be retrieved.
 * @returns {Promise<string[]>} A promise that resolves to an array of public keys if found, or an empty array if not found.
 * @throws {Error} If there is an error executing the query.
 */

async function getAllPublicKeysByEmail(email) {
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
    const result = await queryPostgresDatabase(query, [email]);
    return result.map(row => row.publicKey);
  } catch (error) {
    console.error('Error fetching public keys by email:', error);
    return [];
  }
}

/**
 * Retrieves the user ID for a user identified by the given email.
 *
 * @param {string} email - The email of the user whose ID is to be retrieved.
 * @return {Promise<number|null>} A promise that resolves to the user ID if found, or null if not found.
 * @throws {Error} If there is an error executing the query.
 */
async function getUserIdByEmail(email) {
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
 * Checks if the given public key is marked as deleted.
 *
 * @param {string} publicKey - The public key to check.
 * @return {Promise<boolean>} A promise that resolves to true if the key is deleted, or false if not.
 * @throws {Error} If there is an error executing the query.
 */
async function isKeyDeleted(publicKey) {
  const checkDeletionQuery = `
    SELECT "deletedAt"
    FROM public.user_key
    WHERE "publicKey" = $1;
  `;

  try {
    const deletionResult = await queryPostgresDatabase(checkDeletionQuery, [publicKey]);
    return deletionResult[0]?.deletedAt !== null;
  } catch (error) {
    console.error('Error checking if key is deleted:', error);
    return false;
  }
}

/**
 * Finds a new public key for the user identified by the given user ID, where the key index is 0 and the key is not deleted.
 *
 * @param {number} userId - The ID of the user whose new public key is to be found.
 * @return {Promise<boolean>} A promise that resolves to true if a new key is found, or false if not.
 * @throws {Error} If there is an error executing the query.
 */
async function findNewKey(userId) {
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
 * Retrieves all transaction IDs from the transaction table for a user identified by the given userId.
 *
 * @param {number} userId - The user ID to verify.
 * @return {Promise<string[]>} A promise that resolves to an array of transaction IDs if the user ID exists in transaction_observer.
 * @throws {Error} If there is an error executing the query.
 */
async function getAllTransactionIdsForUserObserver(userId) {
  const query = `
    SELECT t."transactionId"
    FROM public.transaction t
    INNER JOIN public.transaction_observer tobs ON t.id = tobs."transactionId"
    WHERE tobs."userId" = $1;
  `;

  try {
    const result = await queryPostgresDatabase(query, [userId]);
    return result.map(row => row.transactionId);
  } catch (error) {
    console.error('Error fetching transaction IDs for user observer:', error);
    return [];
  }
}

/**
 * Upgrades a user to admin by given email.
 *
 * @param {string} email - The email of the user to be upgraded to admin.
 * @return {Promise<boolean>} A promise that resolves to true if the update is successful, or false if not.
 * @throws {Error} If there is an error executing the query.
 */
async function upgradeUserToAdmin(email) {
  const query = `
    UPDATE public."user"
    SET admin = true, "updatedAt" = now()
    WHERE email = $1;
  `;

  try {
    const result = await queryPostgresDatabase(query, [email]);
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error upgrading user to admin:', error);
    return false;
  }
}

/**
 * Verifies if an organization with the given nickname exists.
 *
 * @param {string} nickname - The nickname of the organization to verify.
 * @return {Promise<boolean>} A promise that resolves to true if the organization exists, or false if not.
 * @throws {Error} If there is an error executing the query.
 */

async function verifyOrganizationExists(nickname) {
  const query = `
      SELECT COUNT(*) AS count
      FROM main.Organization
      WHERE nickname = ?`;

  try {
    const row = await queryDatabase(query, [nickname]);
    return row ? row.count > 0 : false;
  } catch (error) {
    console.error('Error verifying organization:', error);
    return false;
  }
}

module.exports = {
  getFirstPublicKeyByEmail,
  getUserIdByEmail,
  isKeyDeleted,
  findNewKey,
  getAllTransactionIdsForUserObserver,
  upgradeUserToAdmin,
  verifyOrganizationExists,
  getAllPublicKeysByEmail,
};
