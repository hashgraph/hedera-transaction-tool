import {
  queryPostgresDatabase,
  queryDatabase,
  connectPostgresDatabase,
  disconnectPostgresDatabase,
} from './databaseUtil.js';
import { v4 as uuid } from 'uuid';

/**
 * Verifies if a transaction with the given ID and type exists in the database.
 *
 * @param {string} transactionId - The ID of the transaction to verify.
 * @param {string} transactionType - The type of the transaction to verify.
 * @return {Promise<boolean>} A promise that resolves to true if the transaction exists, or false if not.
 * @throws {Error} If there is an error executing the query.
 */
export async function verifyTransactionExists(transactionId: string, transactionType: string) {
  const query = `
        SELECT COUNT(*) AS count
        FROM "Transaction"
        WHERE transaction_id = ? AND type = ?`;

  try {
    const row = await queryDatabase<{count: number}>(query, [transactionId, transactionType]);
    return row.count > 0;
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
export async function verifyAccountExists(accountId: string) {
  const query = `
        SELECT COUNT(*) AS count
        FROM HederaAccount
        WHERE account_id = ?`;

  try {
    const row = await queryDatabase<{count: number}>(query, [accountId]);
    return row.count > 0;
  } catch (error) {
    console.error('Error verifying account:', error);
    return false;
  }
}

/**
 * Deletes an account from the HederaAccount table by the given account ID.
 *
 * @param {string} accountId - The ID of the account to delete.
 * @return {Promise<boolean>} A promise that resolves to true if the account was deleted, or false if not.
 * @throws {Error} If there is an error executing the query.
 */
export async function deleteAccountById(accountId: string) {
  const query = `
        DELETE FROM HederaAccount
        WHERE account_id = ?`;

  try {
    const result = await queryDatabase<number>(query, [accountId]);
    return result > 0;
  } catch (error) {
    console.error('Error deleting account:', error);
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
export async function verifyFileExists(fileId: string) {
  const query = `
        SELECT COUNT(*) AS count
        FROM HederaFile
        WHERE file_id = ?`;

  try {
    const row = await queryDatabase<{ count: number}>(query, [fileId]);
    return row.count > 0;
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

export async function verifyUserExists(email: string) {
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
export async function getPublicKeyByEmail(email: string) {
  const query = `
        SELECT kp.public_key
        FROM KeyPair kp
                 JOIN User u ON u.id = kp.user_id
        WHERE u.email = ?`;

  try {
    const row = await queryDatabase<{public_key: string}>(query, [email]);
    return row.public_key;
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
export async function verifyPrivateKeyExistsByEmail(email: string) {
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
export async function verifyPublicKeyExistsByEmail(email: string) {
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
 * Retrieves all public keys for a user identified by the given email.
 * @param email - The email of the user whose public keys are to be retrieved.
 * @returns {Promise<string[]>} A promise that resolves to an array of public keys if found, or an empty array if not found.
 * @throws {Error} If there is an error executing the query.
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
    const result = await queryPostgresDatabase<{publicKey: string}>(query, [email]);
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
 * Checks if the given public key is marked as deleted.
 *
 * @param {string} publicKey - The public key to check.
 * @return {Promise<boolean>} A promise that resolves to true if the key is deleted, or false if not.
 * @throws {Error} If there is an error executing the query.
 */
export async function isKeyDeleted(publicKey: string) {
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
 * Retrieves all transaction IDs from the transaction table for a user identified by the given userId.
 *
 * @param {number} userId - The user ID to verify.
 * @return {Promise<string[]>} A promise that resolves to an array of transaction IDs if the user ID exists in transaction_observer.
 * @throws {Error} If there is an error executing the query.
 */
export async function getAllTransactionIdsForUserObserver(userId: number) {
  const query = `
    SELECT t."transactionId"
    FROM public.transaction t
    INNER JOIN public.transaction_observer tobs ON t.id = tobs."transactionId"
    WHERE tobs."userId" = $1;
  `;

  try {
    const result = await queryPostgresDatabase<{transactionId: string}>(query, [userId]);
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
export async function upgradeUserToAdmin(email: string) {
  const query = `
    UPDATE public."user"
    SET admin = true, "updatedAt" = now()
    WHERE email = $1;
  `;

  try {
    const result = await queryPostgresDatabase<{rowCount: number}>(query, [email]);
    return result.length > 0;
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

export async function verifyOrganizationExists(nickname: string) {
  const query = `
      SELECT COUNT(*) AS count
      FROM main.Organization
      WHERE nickname = ?`;

  try {
    const row = await queryDatabase<{count: number}>(query, [nickname]);
    return row.count > 0;
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
export async function verifyUserExistsInOrganization(email: string) {
  const query = `
      SELECT COUNT(*) AS count
      FROM public."user"
      WHERE email = $1
  `;

  try {
    const result = await queryPostgresDatabase<{count: number}>(query, [email]);
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
export async function isUserDeleted(email: string) {
  const query = `
    SELECT "deletedAt"
    FROM public."user"
    WHERE email = $1;
  `;

  try {
    const result = await queryPostgresDatabase<{deletedAt: string}>(query, [email]);
    // If the result has a "deletedAt" value that is not null, return true.
    return result[0]?.deletedAt !== null;
  } catch (error) {
    console.error('Error checking if user is deleted:', error);
    return false;
  }
}

/**
 * Inserts a mnemonic hash and public key into the user_key table.
 *
 * @param {number} userId - The ID of the user.
 * @param {string} mnemonicHash - The hashed mnemonic phrase.
 * @param {number} index - The index of the key (typically 0).
 * @param {string} publicKey - The public key derived from the mnemonic phrase.
 * @return {Promise<number|null>} A promise that resolves to the inserted record's ID if successful, or null if not.
 * @throws {Error} If there is an error executing the query.
 */
export async function insertUserKey(userId: number, mnemonicHash: string, index: number, publicKey: string) {
  const query = `
    INSERT INTO public.user_key ("userId", "mnemonicHash", "index", "publicKey")
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `;

  try {
    const result = await queryPostgresDatabase<{id: number}>(query, [userId, mnemonicHash, index, publicKey]);
    return result[0]?.id || null;
  } catch (error) {
    console.error('Error inserting user key:', error);
    return null;
  }
}

/**
 * Inserts a new key pair into the KeyPair table.
 * @param publicKey - the public key
 * @param privateKey - the private key
 * @param secretHash - the secret hash
 * @param organizationUserId - the organization user id
 * @returns {Promise<void>} - a promise that resolves when the key pair is inserted
 */
export async function insertKeyPair(publicKey: string, privateKey: string, secretHash: string, organizationUserId: string) {
  const query = `
      INSERT INTO KeyPair (id, user_id, "index", public_key, private_key, type, organization_id, secret_hash, organization_user_id)
      VALUES (
                 ?,
                 (SELECT id FROM User WHERE email != 'keychain@mode'), -- Exclude user with email 'keychain@mode'
                 0,  -- keyIndex is always 0
                 ?,
                 ?,
                 'ED25519',  -- keyType is always ED25519
                 (SELECT id FROM Organization), -- organization_id is always the id of the organization
                 ?,
                 ?
             );
  `;

  const generatedId = uuid();

  try {
    await queryDatabase(query, [
      generatedId,
      publicKey,
      privateKey,
      secretHash,
      organizationUserId,
    ]);
    console.log('KeyPair record inserted successfully');
  } catch (error) {
    console.error('Error inserting KeyPair record:', error);
  }
}

/**
 * Retrieves all User ids from the user table.
 * @returns {Promise<*|undefined>} - a promise that resolves to an array of user ids
 */
export async function getUserIds() {
  const query = 'SELECT id FROM public."user"';
  return await queryPostgresDatabase(query);
}

/**
 * Ensures that each user has the required notification types in their preferences.
 * If a notification type does not exist for a user, it will be inserted with default values (email: false, inApp: false).
 *
 * @param {number[]} userIds - An array of user IDs for whom the notification preferences should be ensured.
 * @return {Promise<void>} A promise that resolves when the operation is complete.
 * @throws {Error} If there is an error executing the query.
 */
export async function ensureNotificationTypesForUsers(userIds: number[]) {
  const notificationTypes = [
    'TRANSACTION_CREATED',
    'TRANSACTION_WAITING_FOR_SIGNATURES',
    'TRANSACTION_READY_FOR_EXECUTION',
    'TRANSACTION_EXECUTED',
    'TRANSACTION_EXPIRED',
    'TRANSACTION_INDICATOR_APPROVE',
    'TRANSACTION_INDICATOR_SIGN',
    'TRANSACTION_INDICATOR_EXECUTABLE',
    'TRANSACTION_INDICATOR_EXECUTED',
    'TRANSACTION_INDICATOR_EXPIRED',
  ];

  const client = await connectPostgresDatabase();

  try {
    for (const userId of userIds) {
      for (const type of notificationTypes) {
        const query = `
          INSERT INTO public.notification_preferences ("userId", type, email, "inApp")
          SELECT $1, $2::varchar, false, false
          WHERE NOT EXISTS (
            SELECT 1 FROM public.notification_preferences
            WHERE "userId" = $1 AND type = $2::varchar
          );
        `;
        const values = [userId, type];
        await client.query(query, values);
      }
    }
  } catch (err) {
    console.error('Error ensuring notification types for users:', err);
  } finally {
    await disconnectPostgresDatabase(client);
  }
}

/**
 * Disables email notifications and optionally in-app notifications for a list of users by setting the corresponding flags to false.
 *
 * @param {number[]} userIds - An array of user IDs for whom the notification preferences should be updated.
 * @param {boolean} inApp - If true, keeps in-app notifications enabled. If false, disables both email and in-app notifications.
 * @return {Promise<void>} A promise that resolves when the operation is complete.
 * @throws {Error} If there is an error executing the query.
 */
export async function disableNotificationPreferences(userIds: number[], inApp: boolean) {
  const client = await connectPostgresDatabase();

  try {
    const query = `
        UPDATE public.notification_preferences
        SET email = false,
            "inApp" = ${inApp ? 'true' : 'false'}
        WHERE "userId" = ANY($1::int[]);
    `;
    const values = [userIds];
    const result = await client.query(query, values);
    console.log(`Notification preferences updated for user IDs. Rows affected: ${result.rowCount}`);
  } catch (err) {
    console.error('Error disabling notification preferences:', err);
  } finally {
    await disconnectPostgresDatabase(client);
  }
}

/**
 * Disables email notifications and optionally in-app notifications for test users by ensuring that all necessary notification types exist
 * and then setting the email and/or in-app notification flags to false based on the provided argument.
 *
 * @param {boolean} [inApp=false] - If true, keeps in-app notifications enabled. If false, disables both email and in-app notifications.
 * @return {Promise<void>} A promise that resolves when the operation is complete.
 * @throws {Error} If there is an error during the process.
 */
export async function disableNotificationsForTestUsers(inApp = false) {
  try {
    const userIds = await getUserIds();
    const userIdValues = userIds.map(user => user.id);
    await ensureNotificationTypesForUsers(userIdValues);
    await disableNotificationPreferences(userIdValues, inApp);
  } catch (err) {
    console.error('Error disabling notifications for test users:', err);
  }
}

/**
 * Retrieves the latest notification status for a user identified by the given email.
 *
 * @param {string} email - The email of the user.
 * @return {Promise<{isRead: boolean, isInAppNotified: boolean}|null>} A promise that resolves to an object containing
 * 'isRead' and 'isInAppNotified' if a notification is found, or null if not found.
 * @throws {Error} If there is an error executing the query.
 */
export async function getLatestNotificationStatusByEmail(
  email: string,
): Promise<{ isRead: boolean; isInAppNotified: boolean } | null> {
  try {
    const userId = await getUserIdByEmail(email);
    if (!userId) {
      console.error(`User with email ${email} not found.`);
      return null;
    }

    const query = `
      SELECT nr."isRead", nr."isInAppNotified"
      FROM public.notification_receiver nr
      WHERE nr."userId" = $1
      ORDER BY nr."updatedAt" DESC
      LIMIT 1;
    `;

    const result = await queryPostgresDatabase(query, [userId]);
    if (result.length > 0) {
      const { isRead, isInAppNotified } = result[0];
      return { isRead, isInAppNotified };
    } else {
      console.error(`No notifications found for user with ID ${userId}.`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching latest notification status by email:', error);
    return null;
  }
}

/**
 * Retrieves the latest IN-APP notification status for a user identified by the given email.
 * This specifically queries for INDICATOR notification types (which are in-app notifications),
 * not email-only notification types.
 *
 * @param {string} email - The email of the user.
 * @return {Promise<{isRead: boolean, isInAppNotified: boolean}|null>} A promise that resolves to an object containing
 * 'isRead' and 'isInAppNotified' if an in-app notification is found, or null if not found.
 * @throws {Error} If there is an error executing the query.
 */
export async function getLatestInAppNotificationStatusByEmail(
  email: string,
): Promise<{ isRead: boolean; isInAppNotified: boolean } | null> {
  try {
    const userId = await getUserIdByEmail(email);
    if (!userId) {
      console.error(`User with email ${email} not found.`);
      return null;
    }

    const query = `
      SELECT nr."isRead", nr."isInAppNotified"
      FROM public.notification_receiver nr
      JOIN public.notification n ON nr."notificationId" = n.id
      WHERE nr."userId" = $1
        AND n.type LIKE 'TRANSACTION_INDICATOR_%'
      ORDER BY nr."updatedAt" DESC
      LIMIT 1;
    `;

    const result = await queryPostgresDatabase(query, [userId]);
    if (result.length > 0) {
      const { isRead, isInAppNotified } = result[0];
      return { isRead, isInAppNotified };
    } else {
      console.error(`No in-app notifications found for user with ID ${userId}.`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching latest in-app notification status by email:', error);
    return null;
  }
}

/**
 * Gets the SDK transaction ID (e.g., "0.0.123@1234567890.000000000") of the transaction
 * that has the latest unread in-app notification for a user.
 * This is used to find the specific transaction row in the UI.
 */
export async function getNotifiedTransactionIdByEmail(
  email: string,
): Promise<string | null> {
  try {
    const userId = await getUserIdByEmail(email);
    if (!userId) {
      console.error(`User with email ${email} not found.`);
      return null;
    }

    const query = `
      SELECT t."transactionId"
      FROM public.notification_receiver nr
      JOIN public.notification n ON nr."notificationId" = n.id
      JOIN public.transaction t ON n."entityId" = t.id
      WHERE nr."userId" = $1
        AND n.type LIKE 'TRANSACTION_INDICATOR_%'
        AND nr."isRead" = false
      ORDER BY nr."updatedAt" DESC
      LIMIT 1;
    `;

    const result = await queryPostgresDatabase(query, [userId]);
    if (result.length > 0) {
      return result[0].transactionId;
    } else {
      console.error(`No unread in-app notification found for user with ID ${userId}.`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching notified transaction ID:', error);
    return null;
  }
}

/**
 * Retrieves all TransactionGroup rows associated with the given `transaction_id` (not the primary key `id`) from the Transaction table.
 *
 * This function follows these steps:
 * 1. Finds the Transaction row by its `transaction_id` field.
 * 2. Uses the retrieved Transaction's primary key `id` to find related GroupItem entries.
 * 3. Uses the GroupItem entries to find associated TransactionGroup rows.
 *
 * @param {string} inputTransactionId - The `transaction_id` value from the Transaction table (not the primary key `id`).
 * @return {Promise<object[]>} A promise that resolves to an array of TransactionGroup rows.
 *                            If no matching transaction or group items are found, it returns an empty array.
 * @throws {Error} If there is an error executing any query.
 */

export async function getTransactionGroupsForTransactionId(inputTransactionId: string) {
  await new Promise(resolve => setTimeout(resolve, 2000));
  // 1. Get the Transaction by its transaction_id column
  let query = `
    SELECT id
  FROM "Transaction"
  WHERE transaction_id = ?
  `;

  let result;
  try {
    result = await queryDatabase<{id: number}>(query, [inputTransactionId]);
  } catch (error) {
    console.error('Error fetching Transaction by transaction_id:', error);
    return [];
  }

  const transactionId = result.id;

  // 2. Get GroupItem rows for this Transaction's id
  query = `
    SELECT transaction_group_id
  FROM "GroupItem"
  WHERE transaction_id = ?
  `;

  try {
    result = await queryDatabase<{transaction_group_id: number}>(query, [transactionId]);
  } catch (error) {
    console.error('Error fetching GroupItem by Transaction.id:', error);
    return [];
  }

  const transactionGroupIds = [result.transaction_group_id];

  // 3. Find the TransactionGroup rows by these transaction_group_id values
  query = `
    SELECT *
    FROM "TransactionGroup"
  WHERE id = ?
  `;

  try {
    return await queryDatabase(query, transactionGroupIds);
  } catch (error) {
    console.error('Error fetching TransactionGroup by transaction_group_ids:', error);
    return [];
  }
}
