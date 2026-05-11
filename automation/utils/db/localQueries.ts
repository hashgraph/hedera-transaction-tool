import { v4 as uuid } from 'uuid';

import { executeDatabase, queryAllDatabase, queryDatabase } from './databaseUtil.js';

/**
 * Verifies if a transaction with the given ID and type exists in the local SQLite database.
 *
 * @param transactionId - The Hedera transaction ID to verify.
 * @param transactionType - The transaction type to verify.
 * @returns `true` if a matching transaction row exists, otherwise `false`.
 */
export async function verifyTransactionExists(transactionId: string, transactionType: string) {
  const query = `
        SELECT COUNT(*) AS count
        FROM "Transaction"
        WHERE transaction_id = ? AND type = ?`;

  try {
    const row = await queryDatabase<{ count: number }>(query, [transactionId, transactionType]);
    return row.count > 0;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return false;
  }
}

/**
 * Updates a local Transaction row with a new status text and Hedera status code.
 *
 * @param transactionId - The Hedera transaction ID of the row to update.
 * @param status - The status text to store.
 * @param statusCode - The Hedera status code to store.
 * @returns `true` if at least one row was updated, otherwise `false`.
 */
export async function updateLocalTransactionStatus(
  transactionId: string,
  status: string,
  statusCode: number,
) {
  const query = `
        UPDATE "Transaction"
        SET status = ?, status_code = ?
        WHERE transaction_id = ?`;

  try {
    const changedRows = await executeDatabase(query, [status, statusCode, transactionId]);
    return changedRows > 0;
  } catch (error) {
    console.error('Error updating local transaction status:', error);
    return false;
  }
}

/**
 * Verifies if an account with the given account ID exists in the local SQLite database.
 *
 * @param accountId - The account ID to verify.
 * @returns `true` if the account exists, otherwise `false`.
 */
export async function verifyAccountExists(accountId: string) {
  const query = `
        SELECT COUNT(*) AS count
        FROM HederaAccount
        WHERE account_id = ?`;

  try {
    const row = await queryDatabase<{ count: number }>(query, [accountId]);
    return row.count > 0;
  } catch (error) {
    console.error('Error verifying account:', error);
    return false;
  }
}

/**
 * Deletes an account from the local HederaAccount table.
 *
 * @param accountId - The account ID to delete.
 * @returns `true` if a row was deleted, otherwise `false`.
 */
export async function deleteAccountById(accountId: string) {
  const query = `
        DELETE FROM HederaAccount
        WHERE account_id = ?`;

  try {
    const changedRows = await executeDatabase(query, [accountId]);
    return changedRows > 0;
  } catch (error) {
    console.error('Error deleting account:', error);
    return false;
  }
}

/**
 * Verifies if a file with the given file ID exists in the local HederaFile table.
 *
 * @param fileId - The file ID to verify.
 * @returns `true` if the file exists, otherwise `false`.
 */
export async function verifyFileExists(fileId: string) {
  const query = `
        SELECT COUNT(*) AS count
        FROM HederaFile
        WHERE file_id = ?`;

  try {
    const row = await queryDatabase<{ count: number }>(query, [fileId]);
    return row.count > 0;
  } catch (error) {
    console.error('Error verifying file:', error);
    return false;
  }
}

/**
 * Updates the locally cached network metadata for a Hedera file.
 *
 * The Files page renders file details from cached metadata, so tests that mutate
 * a file directly through the SDK need to refresh this field explicitly.
 *
 * @param fileId - The file ID whose metadata should be replaced.
 * @param metaBytes - The new metadata payload to persist.
 * @returns `true` if at least one row was updated, otherwise `false`.
 */
export async function updateLocalFileMetadata(fileId: string, metaBytes: string) {
  const query = `
        UPDATE HederaFile
        SET metaBytes = ?
        WHERE file_id = ?`;

  try {
    const changedRows = await executeDatabase(query, [metaBytes, fileId]);
    return changedRows > 0;
  } catch (error) {
    console.error('Error updating local file metadata:', error);
    return false;
  }
}

/**
 * Verifies if a user with the given email exists in the local User table.
 *
 * @param email - The user email to verify.
 * @returns `true` if a matching user row exists, otherwise `false`.
 */
export async function verifyUserExists(email: string) {
  const query = `
        SELECT *
        FROM User
        WHERE email = ?`;
  try {
    const user = await queryDatabase(query, [email]);
    return user !== undefined;
  } catch (error) {
    console.error('Error verifying user:', error);
    return false;
  }
}

/**
 * Retrieves the public key associated with the local user identified by the given email.
 *
 * @param email - The local user email.
 * @returns The public key if found, otherwise `null`.
 */
export async function getPublicKeyByEmail(email: string) {
  const query = `
        SELECT kp.public_key
        FROM KeyPair kp
                 JOIN User u ON u.id = kp.user_id
        WHERE u.email = ?`;

  try {
    const row = await queryDatabase<{ public_key: string }>(query, [email]);
    return row.public_key;
  } catch (error) {
    console.error('Error fetching public key:', error);
    return null;
  }
}

/**
 * Verifies if a private key exists for the local user identified by the given email.
 *
 * @param email - The local user email.
 * @returns `true` if a private key row exists for the user, otherwise `false`.
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
 * Verifies if a public key exists for the local user identified by the given email.
 *
 * @param email - The local user email.
 * @returns `true` if a public key row exists for the user, otherwise `false`.
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
 * Retrieves a key pair for the local user identified by the given email and key index.
 *
 * @param email - The local user email.
 * @param index - The key index to retrieve.
 * @returns The matching key pair row, or `null` when not found or on query failure.
 */
export async function getKeyPairByIndexAndEmail(
  email: string,
  index: number,
): Promise<{ public_key?: string; private_key?: string } | null> {
  const query = `
      SELECT public_key, private_key
      FROM KeyPair kp
      JOIN User u ON u.id = kp.user_id
      WHERE u.email = ? AND kp."index" = ?`;

  try {
    const row = await queryDatabase<{ public_key?: string; private_key?: string } | undefined>(
      query,
      [email, index],
    );
    return row ?? null;
  } catch (error) {
    console.error('Error fetching key pair for index:', error);
    return null;
  }
}

/**
 * Inserts a new key pair into the local KeyPair table.
 *
 * When `localUserId` and `localOrganizationId` are both provided, the row is bound to
 * those exact rows. Otherwise the user/organization are looked up via subqueries on
 * the local tables — convenient for single-org test setups.
 *
 * @param publicKey - The public key.
 * @param privateKey - The encrypted/serialized private key.
 * @param secretHash - The secret hash associated with the key pair.
 * @param organizationUserId - The remote organization user ID this key belongs to.
 * @param localUserId - Optional local User row ID to bind the key pair to.
 * @param localOrganizationId - Optional local Organization row ID to bind the key pair to.
 */
export async function insertKeyPair(
  publicKey: string,
  privateKey: string,
  secretHash: string,
  organizationUserId: string,
  localUserId?: string,
  localOrganizationId?: string,
) {
  const generatedId = uuid();

  const query =
    localUserId && localOrganizationId
      ? `
          INSERT INTO KeyPair (
            id,
            user_id,
            "index",
            public_key,
            private_key,
            type,
            organization_id,
            secret_hash,
            organization_user_id
          )
          VALUES (?, ?, 0, ?, ?, 'ED25519', ?, ?, ?);
        `
      : `
          INSERT INTO KeyPair (
            id,
            user_id,
            "index",
            public_key,
            private_key,
            type,
            organization_id,
            secret_hash,
            organization_user_id
          )
          VALUES (
            ?,
            (SELECT id FROM User WHERE email != 'keychain@mode'),
            0,
            ?,
            ?,
            'ED25519',
            (SELECT id FROM Organization),
            ?,
            ?
          );
        `;

  const params =
    localUserId && localOrganizationId
      ? [
          generatedId,
          localUserId,
          publicKey,
          privateKey,
          localOrganizationId,
          secretHash,
          organizationUserId,
        ]
      : [generatedId, publicKey, privateKey, secretHash, organizationUserId];

  try {
    await queryDatabase(query, params);
    console.log('KeyPair record inserted successfully');
  } catch (error) {
    console.error('Error inserting KeyPair record:', error);
  }
}

/**
 * Verifies if an organization with the given nickname exists in the local Organization table.
 *
 * @param nickname - The organization nickname to verify.
 * @returns `true` if a matching row exists, otherwise `false`.
 */
export async function verifyOrganizationExists(nickname: string) {
  const query = `
      SELECT COUNT(*) AS count
      FROM main.Organization
      WHERE nickname = ?`;

  try {
    const row = await queryDatabase<{ count: number }>(query, [nickname]);
    return row.count > 0;
  } catch (error) {
    console.error('Error verifying organization:', error);
    return false;
  }
}

/**
 * Retrieves all TransactionGroup rows associated with the given Hedera `transaction_id`
 * (the SDK transaction ID, not the Transaction primary key).
 *
 * The lookup is performed in three steps:
 *   1. Resolve the Transaction primary key from `transaction_id`.
 *   2. Find GroupItem entries that reference that Transaction.
 *   3. Load the TransactionGroup rows referenced by those GroupItems.
 *
 * @param inputTransactionId - The SDK `transaction_id` value (not the row primary key).
 * @returns An array of TransactionGroup rows; empty when no transaction or group items match.
 */
export async function getTransactionGroupsForTransactionId(inputTransactionId: string) {
  await new Promise(resolve => setTimeout(resolve, 2000));
  // 1. Get the Transaction by its transaction_id column
  let transactionRow: { id: number } | undefined;
  try {
    transactionRow = await queryDatabase<{ id: number }>(
      `SELECT id FROM "Transaction" WHERE transaction_id = ?`,
      [inputTransactionId],
    );
  } catch (error) {
    console.error('Error fetching Transaction by transaction_id:', error);
    return [];
  }

  if (!transactionRow) return [];

  // 2. Get GroupItem rows for this Transaction's id
  let groupItems: { transaction_group_id: number }[];
  try {
    groupItems = await queryAllDatabase<{ transaction_group_id: number }>(
      `SELECT transaction_group_id FROM "GroupItem" WHERE transaction_id = ?`,
      [transactionRow.id],
    );
  } catch (error) {
    console.error('Error fetching GroupItem by Transaction.id:', error);
    return [];
  }

  if (groupItems.length === 0) return [];

  const transactionGroupIds = groupItems.map(row => row.transaction_group_id);

  // 3. Find the TransactionGroup rows by these transaction_group_id values
  const placeholders = transactionGroupIds.map(() => '?').join(', ');
  try {
    return await queryAllDatabase(
      `SELECT * FROM "TransactionGroup" WHERE id IN (${placeholders})`,
      transactionGroupIds,
    );
  } catch (error) {
    console.error('Error fetching TransactionGroup by transaction_group_ids:', error);
    return [];
  }
}
