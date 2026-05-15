import { randomUUID } from 'node:crypto';
import { executeDatabase } from './databaseUtil.js';

// Prisma stores SQLite DateTime as epoch milliseconds.
function nowEpochMs(): number {
  return Date.now();
}

/**
 * Seeds `count` rows into the TransactionDraft table for the given user.
 * Used by pagination tests that need to exercise AppPager without driving
 * `count` UI flows. The transactionBytes column is left empty — Drafts.vue
 * renders the row from `type` alone for non-freeze types (`getDisplayTransactionType`
 * only inspects bytes when type is `Freeze`).
 */
export async function seedTransactionDrafts(userId: string, count: number): Promise<void> {
  const baseTime = nowEpochMs();
  for (let i = 0; i < count; i++) {
    const id = randomUUID();
    // Stagger created_at by 1ms so default `created_at desc` ordering is stable.
    const createdAt = baseTime - (count - i);
    await executeDatabase(
      `INSERT INTO "TransactionDraft" (id, created_at, updated_at, user_id, type, transactionBytes, description, isTemplate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, createdAt, createdAt, userId, 'AccountCreate', '', `pagination draft ${i + 1}`, 0],
    );
  }
}

/**
 * Seeds `count` rows into the Transaction table for the given user/network.
 * Used by History pagination tests. status_code 22 = SUCCESS in Hedera; the
 * History row renders the green badge for codes [0, 22, 338].
 */
export async function seedHistoryTransactions(
  userId: string,
  count: number,
  network: string,
): Promise<void> {
  const baseTime = nowEpochMs();
  for (let i = 0; i < count; i++) {
    const id = randomUUID();
    const createdAt = baseTime - (count - i);
    const transactionId = `0.0.1001@${Math.floor(createdAt / 1000)}.${i.toString().padStart(9, '0')}`;
    await executeDatabase(
      `INSERT INTO "Transaction" (
         id, name, type, description, transaction_id, transaction_hash, body, status, status_code,
         user_id, signature, valid_start, executed_at, created_at, updated_at, network
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        `pagination tx ${i + 1}`,
        'AccountCreate',
        `pagination history ${i + 1}`,
        transactionId,
        '',
        '',
        'SUCCESS',
        22,
        userId,
        '',
        String(createdAt),
        Math.floor(createdAt / 1000),
        createdAt,
        createdAt,
        network,
      ],
    );
  }
}