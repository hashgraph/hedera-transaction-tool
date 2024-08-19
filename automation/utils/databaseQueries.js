const { queryPostgresDatabase, queryDatabase } = require('./databaseUtil');

/**
 * Verifies if a transaction with the given ID and type exists in the database.
 *
 * @param {string} transactionId - The ID of the transaction to verify.
 * @param {string} transactionType - The type of the transaction to verify.
 * @return {Promise<boolean>} A promise that resolves to true if the transaction exists, or false if not.
 * @throws {Error} If there is an error executing the query.
 */
async function verifyTransactionExists(transactionId, transactionType) {
  const query = `
        SELECT COUNT(*) AS count
        FROM "Transaction"
        WHERE transaction_id = ? AND type = ?`;

  try {
    const row = await queryDatabase(query, [transactionId, transactionType]);
    return row ? row.count > 0 : false;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return false;
  }
}

/**
 * Verifies if an account with the given account ID exists in the database.
 *
 * @param {string} accountId - The ID of the account to verify.
 * @return {Promise<boolean>} A promise that resolves to true if the account exists, or false if not.
 * @throws {Error} If there is an error executing the query.
 */
async function verifyAccountExists(accountId) {
  const query = `
        SELECT COUNT(*) AS count
        FROM HederaAccount
        WHERE account_id = ?`;

  try {
    const row = await queryDatabase(query, [accountId]);
    return row ? row.count > 0 : false;
  } catch (error) {
    console.error('Error verifying account:', error);
    return false;
  }
}

/**
 * Verifies if a file with the given file ID exists in the database.
 *
 * @param {string} fileId - The ID of the file to verify.
 * @return {Promise<boolean>} A promise that resolves to true if the file exists, or false if not.
 * @throws {Error} If there is an error executing the query.
 */
async function verifyFileExists(fileId) {
  const query = `
        SELECT COUNT(*) AS count
        FROM HederaFile
        WHERE file_id = ?`;

  try {
    const row = await queryDatabase(query, [fileId]);
    return row ? row.count > 0 : false;
  } catch (error) {
    console.error('Error verifying file:', error);
    return false;
  }
}

/**
 * Verifies if a user with the given email exists in the database.
 *
 * @param {string} email - The email of the user to verify.
 * @return {Promise<boolean>} A promise that resolves to true if the user exists, or false if not.
 * @throws {Error} If there is an error executing the query.
 */

async function verifyUserExists(email) {
  const query = `
        SELECT *
        FROM User
        WHERE email = ?`;
  const user = await queryDatabase(query, [email]);
  return user !== undefined;
}

/**
 * Retrieves the public key associated with the user identified by the given email.
 *
 * @param {string} email - The email of the user whose public key is to be retrieved.
 * @return {Promise<string|null>} A promise that resolves to the public key if found, or null if not found.
 * @throws {Error} If there is an error executing the query.
 */
async function getPublicKeyByEmail(email) {
  const query = `
        SELECT kp.public_key
        FROM KeyPair kp
                 JOIN User u ON u.id = kp.user_id
        WHERE u.email = ?`;

  try {
    const row = await queryDatabase(query, [email]);
    return row ? row.public_key : null;
  } catch (error) {
    console.error('Error fetching public key:', error);
    return null;
  }
}

/**
 * Verifies if a private key exists for the user identified by the given email.
 *
 * @param {string} email - The email of the user whose private key existence is to be verified.
 * @return {Promise<boolean>} A promise that resolves to true if a private key exists, or false if not.
 * @throws {Error} If there is an error executing the query.
 */
async function verifyPrivateKeyExistsByEmail(email) {
  const query = `
        SELECT kp.private_key
        FROM KeyPair kp
                 JOIN User u ON u.id = kp.user_id
        WHERE u.email = ?
          AND kp.private_key IS NOT NULL`;

  try {
    const row = await queryDatabase(query, [email]);
    return row !== undefined;
  } catch (error) {
    console.error('Error checking for private key:', error);
    return false;
  }
}

/**
 * Verifies if a public key exists for the user identified by the given email.
 *
 * @param {string} email - The email of the user whose public key existence is to be verified.
 * @return {Promise<boolean>} A promise that resolves to true if a public key exists, or false if not.
 * @throws {Error} If there is an error executing the query.
 */
async function verifyPublicKeyExistsByEmail(email) {
  const query = `
        SELECT kp.public_key
        FROM KeyPair kp
                 JOIN User u ON u.id = kp.user_id
        WHERE u.email = ?
          AND kp.private_key IS NOT NULL`;

  try {
    const row = await queryDatabase(query, [email]);
    return row !== undefined;
  } catch (error) {
    console.error('Error checking for private key:', error);
    return false;
  }
}

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

/**
 * Verifies if a user with the given email exists.
 *
 * @param {string} email - The email of the user to verify.
 * @return {Promise<boolean>} A promise that resolves to true if the user exists, or false if not.
 * @throws {Error} If there is an error executing the query.
 */
async function verifyUserExistsInOrganization(email) {
  const query = `
      SELECT COUNT(*) AS count
      FROM public."user"
      WHERE email = $1
  `;

  try {
    const result = await queryPostgresDatabase(query, [email]);
    return result[0]?.count > 0;
  } catch (error) {
    console.error('Error verifying user:', error);
    return false;
  }
}

/**
 * Checks if the user with the given email has been marked as deleted.
 *
 * @param {string} email - The email of the user to check.
 * @return {Promise<boolean>} A promise that resolves to true if the user has been marked as deleted, or false if not.
 * @throws {Error} If there is an error executing the query.
 */
async function isUserDeleted(email) {
  const query = `
    SELECT "deletedAt"
    FROM public."user"
    WHERE email = $1;
  `;

  try {
    const result = await queryPostgresDatabase(query, [email]);
    // If the result has a "deletedAt" value that is not null, return true.
    return result[0]?.deletedAt !== null;
  } catch (error) {
    console.error('Error checking if user is deleted:', error);
    return false;
  }
}

module.exports = {
  verifyTransactionExists,
  verifyAccountExists,
  verifyFileExists,
  verifyUserExists,
  getPublicKeyByEmail,
  verifyPrivateKeyExistsByEmail,
  verifyPublicKeyExistsByEmail,
  getFirstPublicKeyByEmail,
  getUserIdByEmail,
  isKeyDeleted,
  findNewKey,
  getAllTransactionIdsForUserObserver,
  upgradeUserToAdmin,
  verifyOrganizationExists,
  getAllPublicKeysByEmail,
  verifyUserExistsInOrganization,
  isUserDeleted,
};
