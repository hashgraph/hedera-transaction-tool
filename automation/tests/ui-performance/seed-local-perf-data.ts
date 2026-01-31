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

import sqlite3 from 'sqlite3';
import crypto from 'node:crypto';
import { getDatabasePath } from '../../utils/databaseUtil.js';
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

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(err);
      }
    });

    db.get<{ id: string }>(
      'SELECT id FROM User WHERE email = ?',
      [email],
      (err, row) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(row?.id || null);
        }
      },
    );
  });
}

async function seedDrafts(db: sqlite3.Database, userId: string): Promise<number> {
  return new Promise((resolve, reject) => {
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

      stmt.run([id, userId, type, transactionBytes, description], function (err) {
        if (err) {
          console.error(`Error inserting draft ${i}:`, err.message);
        } else {
          inserted++;
        }
      });
    }

    stmt.finalize((err) => {
      if (err) {
        reject(err);
      } else {
        resolve(inserted);
      }
    });
  });
}

async function seedAccounts(db: sqlite3.Database, userId: string): Promise<number> {
  return new Promise((resolve, reject) => {
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

      stmt.run([id, userId, accountId, nickname, network], function (err) {
        if (err) {
          console.error(`Error inserting account ${i}:`, err.message);
        } else {
          inserted++;
        }
      });
    }

    stmt.finalize((err) => {
      if (err) {
        reject(err);
      } else {
        resolve(inserted);
      }
    });
  });
}

async function seedFiles(db: sqlite3.Database, userId: string): Promise<number> {
  return new Promise((resolve, reject) => {
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

      stmt.run([id, userId, fileId, network, nickname, description], function (err) {
        if (err) {
          console.error(`Error inserting file ${i}:`, err.message);
        } else {
          inserted++;
        }
      });
    }

    stmt.finalize((err) => {
      if (err) {
        reject(err);
      } else {
        resolve(inserted);
      }
    });
  });
}

/**
 * Seed history transactions to SQLite Transaction table
 */
async function seedHistoryTransactions(db: sqlite3.Database, userId: string): Promise<number> {
  return new Promise((resolve, reject) => {
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

      stmt.run(
        [
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
        ],
        function (err) {
          if (err) {
            console.error(`Error inserting history transaction ${i}:`, err.message);
          } else {
            inserted++;
          }
        },
      );
    }

    stmt.finalize((err) => {
      if (err) {
        reject(err);
      } else {
        resolve(inserted);
      }
    });
  });
}

export async function seedLocalPerfData(userEmail: string): Promise<SeedResult> {
  const userId = await getUserIdByEmail(userEmail);

  if (!userId) {
    throw new Error(`User not found: ${userEmail}`);
  }

  const dbPath = getDatabasePath();

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, async (err) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const drafts = await seedDrafts(db, userId);
        const accounts = await seedAccounts(db, userId);
        const files = await seedFiles(db, userId);
        const history = await seedHistoryTransactions(db, userId);

        db.close((closeErr) => {
          if (closeErr) {
            console.error('Error closing database:', closeErr.message);
          }
          resolve({ drafts, accounts, files, history });
        });
      } catch (seedErr) {
        db.close();
        reject(seedErr);
      }
    });
  });
}
