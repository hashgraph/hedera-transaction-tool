/**
 * SQLite Performance Data Seeder
 *
 * Seeds local SQLite database with test data for UI performance tests.
 * Call after user registration to populate:
 * - 100 TransactionDrafts
 * - 100 HederaAccounts
 * - 100 HederaFiles
 * - 500 History Transactions
 */

import type Database from 'better-sqlite3';
import { openSqliteDatabase } from '../../utils/db/sqlite.js';
import crypto from 'node:crypto';
import { getDatabasePath } from '../../utils/db/databaseUtil.js';
import { DATA_VOLUMES } from '../../k6/src/config/constants.js';

// Use DATA_VOLUMES for SSOT
const TARGET_COUNT = DATA_VOLUMES.DRAFTS;
const HISTORY_COUNT = DATA_VOLUMES.HISTORY;

interface SeedResult {
  drafts: number;
  accounts: number;
  files: number;
  history: number;
}

/**
 * Get the user ID from SQLite by email
 */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const dbPath = getDatabasePath();

  const db = openSqliteDatabase(dbPath, true);
  try {
    const row = db
      .prepare<[string], { id: string }>('SELECT id FROM User WHERE email = ?')
      .get(email);
    return row?.id || null;
  } finally {
    db.close();
  }
}

async function seedDrafts(db: Database.Database, userId: string): Promise<number> {
  const stmt = db.prepare(`
      INSERT INTO TransactionDraft (id, created_at, updated_at, user_id, type, transactionBytes, description, isTemplate)
      VALUES (?, datetime('now'), datetime('now'), ?, ?, ?, ?, 0)
    `);

  let inserted = 0;
  for (let i = 0; i < TARGET_COUNT; i++) {
    const id = crypto.randomUUID();
    const type = 'CRYPTO_TRANSFER';
    const transactionBytes = Buffer.from(`perf-test-draft-${i}`).toString('base64');
    const description = `Performance test draft ${i + 1}`;

    stmt.run([id, userId, type, transactionBytes, description]);
    inserted++;
  }

  return inserted;
}

async function seedAccounts(db: Database.Database, userId: string): Promise<number> {
  const stmt = db.prepare(`
      INSERT INTO HederaAccount (id, user_id, account_id, nickname, network, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);

  let inserted = 0;
  for (let i = 0; i < TARGET_COUNT; i++) {
    const id = crypto.randomUUID();
    const accountId = `0.0.${1000 + i}`;
    const nickname = `Perf Test Account ${i + 1}`;
    const network = 'mainnet';

    stmt.run([id, userId, accountId, nickname, network]);
    inserted++;
  }

  return inserted;
}

async function seedFiles(db: Database.Database, userId: string): Promise<number> {
  const stmt = db.prepare(`
      INSERT INTO HederaFile (id, user_id, file_id, network, created_at, nickname, description)
      VALUES (?, ?, ?, ?, datetime('now'), ?, ?)
    `);

  let inserted = 0;
  for (let i = 0; i < TARGET_COUNT; i++) {
    const id = crypto.randomUUID();
    const fileId = `0.0.${2000 + i}`;
    const network = 'mainnet';
    const nickname = `Perf Test File ${i + 1}`;
    const description = `Performance test file ${i + 1}`;

    stmt.run([id, userId, fileId, network, nickname, description]);
    inserted++;
  }

  return inserted;
}

/**
 * Seed history transactions to SQLite Transaction table
 */
async function seedHistoryTransactions(db: Database.Database, userId: string): Promise<number> {
  const stmt = db.prepare(`
      INSERT INTO "Transaction" (
        id, name, type, description, transaction_id, transaction_hash,
        body, status, status_code, user_id, signature, valid_start,
        executed_at, created_at, updated_at, network
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `);

  // Status codes distribution: 80% success, 20% mixed failures
  const statusCodes = [
    { code: 0, status: 'SUCCESS', weight: 80 },
    { code: 21, status: 'INVALID_TRANSACTION', weight: 5 },
    { code: 4, status: 'TRANSACTION_EXPIRED', weight: 5 },
    { code: 9, status: 'INSUFFICIENT_PAYER_BALANCE', weight: 5 },
    { code: 11, status: 'DUPLICATE_TRANSACTION', weight: 5 },
  ];

  const transactionTypes = [
    'CRYPTO_TRANSFER',
    'CRYPTO_CREATE_ACCOUNT',
    'CRYPTO_UPDATE_ACCOUNT',
    'FILE_CREATE',
    'FILE_UPDATE',
    'CONTRACT_CALL',
  ];

  let inserted = 0;
  const now = Math.floor(Date.now() / 1000); // Unix timestamp

  for (let i = 0; i < HISTORY_COUNT; i++) {
    const id = crypto.randomUUID();
    const name = `Test Transaction ${i + 1}`;
    const type = transactionTypes[i % transactionTypes.length];
    const description = `Performance test history transaction ${i + 1}`;
    const transactionId = `0.0.${1000 + i}@${now - i}.000000000`;
    const transactionHash = crypto.randomBytes(48).toString('hex');
    const body = Buffer.from(`perf-test-history-${i}`).toString('base64');

    // Pick status based on weighted distribution
    const rand = Math.random() * 100;
    let cumulative = 0;
    let selectedStatus = statusCodes[0];
    for (const sc of statusCodes) {
      cumulative += sc.weight;
      if (rand < cumulative) {
        selectedStatus = sc;
        break;
      }
    }

    const signature = crypto.randomBytes(64).toString('hex');
    const validStart = `${now - i - 3600}`; // 1 hour before executed
    const executedAt = now - i; // Stagger execution times
    const network = 'mainnet';

    stmt.run([
      id,
      name,
      type,
      description,
      transactionId,
      transactionHash,
      body,
      selectedStatus.status,
      selectedStatus.code,
      userId,
      signature,
      validStart,
      executedAt,
      network,
    ]);
    inserted++;
  }

  return inserted;
}

export async function seedLocalPerfData(userEmail: string): Promise<SeedResult> {
  const userId = await getUserIdByEmail(userEmail);

  if (!userId) {
    throw new Error(`User not found: ${userEmail}`);
  }

  const dbPath = getDatabasePath();

  const db = openSqliteDatabase(dbPath);
  try {
    const drafts = await seedDrafts(db, userId);
    const accounts = await seedAccounts(db, userId);
    const files = await seedFiles(db, userId);
    const history = await seedHistoryTransactions(db, userId);
    return { drafts, accounts, files, history };
  } finally {
    db.close();
  }
}
