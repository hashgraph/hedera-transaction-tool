import { executeDatabase, queryDatabase } from './databaseUtil.js';

/**
 * Returns the public key of the most recently inserted external KeyPair
 * (renderer convention: externally-imported keys are stored with index = -1)
 * for the given local user.
 */
export async function getLatestExternalKeyPublicKey(userId: string): Promise<string> {
  const row = await queryDatabase<{ public_key: string } | undefined>(
    `SELECT public_key FROM KeyPair WHERE user_id = ? AND "index" = -1 ORDER BY rowid DESC LIMIT 1`,
    [userId],
  );
  if (!row?.public_key) {
    throw new Error(`No external KeyPair (index = -1) found for user ${userId}`);
  }
  return row.public_key;
}

/**
 * Deletes a KeyPair row by public_key. Used by tests that need to orphan a
 * locally-stored key while leaving the organization server's record intact,
 * so the renderer's `missingKeys` flow can be exercised.
 */
export async function deleteKeyPairByPublicKey(publicKey: string): Promise<void> {
  await executeDatabase(`DELETE FROM "KeyPair" WHERE public_key = ?`, [publicKey]);
}