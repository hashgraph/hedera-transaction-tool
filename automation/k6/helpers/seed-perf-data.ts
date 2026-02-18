/**
 * Seed Performance Test Data
 *
 * Creates test transactions in PostgreSQL for k6 performance tests.
 * Uses real Hedera SDK transactions so the /transactions/sign endpoint works.
 *
 * Usage:
 *   cd automation && npx tsx k6/helpers/seed-perf-data.ts
 *
 * Prerequisites:
 *   - Docker Postgres running (docker-compose up -d)
 *   - Test user created (npm run k6:seed)
 *
 * Environment variables:
 *   TEST_USER_EMAIL - Email of test user to link transactions to (default: k6perf@test.com)
 *   SEED_POOL       - Set to 'true' to seed for all pool users
 *
 * Database connection:
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DATABASE, POSTGRES_USERNAME, POSTGRES_PASSWORD
 */

import 'dotenv/config';
import { Client, QueryResult } from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import {
  PrivateKey,
  Mnemonic,
  FileCreateTransaction,
  AccountId,
  Transaction,
} from '@hashgraph/sdk';
import { DATA_VOLUMES, SEED_MARKER, TEST_USER_POOL } from '../src/config/constants.js';
import type { SignatureMap } from '../src/types/api.types.js';
import { type ComplexKeyResult } from './complex-keys.js';
import { proto } from '@hashgraph/proto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mirror network - must match the value used in k6 test scripts (defaults to mainnet)
const MIRROR_NETWORK = process.env.HEDERA_NETWORK === 'testnet' ? 'testnet' : 'mainnet';

// Generated keypair for signing - stored in user_key table
let testPrivateKey: PrivateKey;
let testPublicKeyHex: string;
let testMnemonic: Mnemonic;
let testMnemonicHash: string;

const SIGN_COUNT = DATA_VOLUMES.READY_TO_SIGN;
const HISTORY_COUNT = DATA_VOLUMES.HISTORY;
const APPROVE_COUNT = DATA_VOLUMES.READY_FOR_REVIEW;
const GROUP_SIZE = DATA_VOLUMES.GROUP_SIZE;
const EXECUTION_COUNT = DATA_VOLUMES.READY_FOR_EXECUTION;
const DEBUG = process.env.DEBUG === 'true';

interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

function getDbConfig(): DbConfig {
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number.parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DATABASE || 'postgres',
    user: process.env.POSTGRES_USERNAME || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  };
}

interface UserRow {
  id: number;
}

interface UserKeyRow {
  id: number;
}

interface TransactionRow {
  id: number;
}

interface SignTransactionData {
  transactionId: string;
  unsignedBytes: Uint8Array;
}

const HISTORY_STATUSES = ['EXECUTED', 'FAILED', 'EXPIRED', 'CANCELED', 'ARCHIVED'] as const;

const signTransactionsData: SignTransactionData[] = [];

/**
 * Serialize a public key to protobuf format (same as backend's serializeKey)
 * This matches back-end/libs/common/src/utils/sdk/key.ts:48-51
 */
function serializeKeyToProtobuf(key: { _toProtobufKey: () => proto.IKey }): Buffer {
  const protoKey = key._toProtobufKey();
  return Buffer.from(proto.Key.encode(protoKey).finish());
}

/**
 * Seed CachedAccount with test public key so Mirror Node is not queried.
 * This makes the fee payer (0.0.2) resolve to our test key instead of real mainnet key.
 *
 * The backend checks CachedAccount first - if encodedKey exists, it returns
 * cached data without calling Mirror Node.
 *
 * Also creates cached_account_key record linking the public key to the cached account.
 * This is required for the optimized /transaction-nodes endpoint to work.
 *
 * @returns The cachedAccountId for linking transactions
 */
async function seedCachedAccount(client: Client, publicKeyHex: string): Promise<number> {
  const accountId = '0.0.2'; // Fee payer used in transactions
  const mirrorNetwork = MIRROR_NETWORK;

  // Delete existing cached account keys first (cascade will handle this via FK)
  // Then delete cached account
  await client.query(
    `DELETE FROM cached_account WHERE account = $1 AND "mirrorNetwork" = $2`,
    [accountId, mirrorNetwork],
  );

  // Create PublicKey from hex and serialize to protobuf
  // Import PublicKey from sdk to create the key object
  const { PublicKey } = await import('@hashgraph/sdk');
  const publicKey = PublicKey.fromString(publicKeyHex);
  const encodedKey = serializeKeyToProtobuf(publicKey as any);

  // Insert cached account with test public key and get the ID
  const cachedAccountResult: QueryResult<{ id: number }> = await client.query(
    `INSERT INTO cached_account (
       account, "mirrorNetwork", "encodedKey",
       "receiverSignatureRequired", "createdAt", "updatedAt"
     )
     VALUES ($1, $2, $3, false, NOW(), NOW())
     RETURNING id`,
    [accountId, mirrorNetwork, encodedKey],
  );
  const cachedAccountId = cachedAccountResult.rows[0].id;

  // Create cached_account_key linking public key to cached account
  // This is required for /transaction-nodes?collection=READY_TO_SIGN to work
  await client.query(
    `INSERT INTO cached_account_key ("cachedAccountId", "publicKey")
     VALUES ($1, $2)
     ON CONFLICT ("cachedAccountId", "publicKey") DO NOTHING`,
    [cachedAccountId, publicKeyHex],
  );

  console.log(`✓ Seeded CachedAccount: ${accountId} with test public key (${publicKeyHex.substring(0, 16)}...)`);
  console.log(`✓ Seeded CachedAccountKey: linked publicKey to cachedAccount (id: ${cachedAccountId})`);

  return cachedAccountId;
}

const DEFAULT_EMAIL = 'k6perf@test.com';

function getTestUserEmail(): string {
  return process.env.TEST_USER_EMAIL || DEFAULT_EMAIL;
}

async function initializeKeyPair(): Promise<void> {
  // Generate a mnemonic (24 words) so it can be imported during Account Setup
  testMnemonic = await Mnemonic.generate();
  testPrivateKey = await testMnemonic.toStandardEd25519PrivateKey('', 0);
  // Get public key in hex format (without DER prefix for storage)
  testPublicKeyHex = testPrivateKey.publicKey.toStringRaw();

  // Hash the mnemonic the same way front-end does: words.toString() (comma-separated)
  // This is required for accountSetupRequired() to return false
  const mnemonicWords = testMnemonic.toString().split(' ');
  testMnemonicHash = await argon2.hash(mnemonicWords.toString(), {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  console.log(`Generated test keypair from mnemonic: ${testPublicKeyHex.substring(0, 16)}...`);
  console.log(`Mnemonic hash: ${testMnemonicHash.substring(0, 30)}...`);
}

function generateTransactionId(index: number): string {
  const accountId = 1000 + index;
  const timestamp = Math.floor(Date.now() / 1000);
  return `0.0.${accountId}@${timestamp}.${index}`;
}

function generateTransactionHash(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function findOrCreateUserKey(
  client: Client,
  userId: number,
): Promise<number> {
  // Store the actual public key (raw hex) - must match what SDK's toStringRaw() returns
  // The backend compares user.keys against transaction's required keys using this format
  // IMPORTANT: Include mnemonicHash and index so accountSetupRequired() returns false
  // Without mnemonicHash, the Import flow gets stuck on Key Pairs screen
  const result: QueryResult<UserKeyRow> = await client.query(
    `INSERT INTO user_key ("userId", "publicKey", "mnemonicHash", "index", "deletedAt")
     VALUES ($1, $2, $3, $4, NULL)
     RETURNING id`,
    [userId, testPublicKeyHex, testMnemonicHash, 0],
  );

  console.log(`Created UserKey: ${result.rows[0].id} (publicKey: ${testPublicKeyHex.substring(0, 16)}..., mnemonicHash: present, index: 0)`);
  return result.rows[0].id;
}

/**
 * Seed multiple keys for complex threshold key testing.
 * Inserts ALL private keys from a ComplexKeyResult into the user_key table.
 *
 * @param client - PostgreSQL client
 * @param userId - User ID to associate keys with
 * @param complexKey - ComplexKeyResult with keys and metadata
 * @param mnemonicHash - Hash to use for all keys (required for accountSetupRequired() check)
 * @returns Array of inserted user_key IDs
 */
export async function seedComplexKeys(
  client: Client,
  userId: number,
  complexKey: ComplexKeyResult,
  mnemonicHash: string,
): Promise<number[]> {
  const userKeyIds: number[] = [];

  console.log(`\nSeeding ${complexKey.allPrivateKeys.length} complex threshold keys for user ${userId}...`);

  for (let i = 0; i < complexKey.allPrivateKeys.length; i++) {
    const privateKey = complexKey.allPrivateKeys[i];
    const publicKeyHex = privateKey.publicKey.toStringRaw();

    // Use provided mnemonicHash so accountSetupRequired() returns false
    // The same hash must be used in SQLite KeyPair.secret_hash
    const result: QueryResult<UserKeyRow> = await client.query(
      `INSERT INTO user_key ("userId", "publicKey", "mnemonicHash", "index", "deletedAt")
       VALUES ($1, $2, $3, $4, NULL)
       RETURNING id`,
      [userId, publicKeyHex, mnemonicHash, i],
    );

    userKeyIds.push(result.rows[0].id);

    if ((i + 1) % 20 === 0 || i === complexKey.allPrivateKeys.length - 1) {
      console.log(`  Inserted ${i + 1}/${complexKey.allPrivateKeys.length} keys`);
    }
  }

  console.log(`  Completed: ${userKeyIds.length} complex keys seeded`);
  return userKeyIds;
}

/**
 * Create a FileCreateTransaction that requires complex threshold key signatures.
 * The file key is set to the complex KeyList, so signing requires satisfying the threshold.
 *
 * @param index - Transaction index for unique IDs
 * @param complexKey - ComplexKeyResult with the threshold key structure
 * @returns Transaction data including bytes and IDs
 */
// Offset for complex key transactions (must be MORE negative than regular group's -3600)
// This ensures complex key group appears on page 1 before regular group with ASC sorting
const COMPLEX_KEY_TIMESTAMP_OFFSET_SECONDS = -7200; // 2 hours in the past

function createComplexKeyTransaction(
  index: number,
  complexKey: ComplexKeyResult,
): {
  transactionBytes: Buffer;
  unsignedTransactionBytes: Buffer;
  transactionId: string;
  transactionHash: string;
  validStart: Date;
  signature: Buffer;
} {
  const now = new Date();
  // Apply offset so complex key transactions sort before regular group transactions
  const validStart = new Date(now.getTime() + COMPLEX_KEY_TIMESTAMP_OFFSET_SECONDS * 1000);

  // Create FileCreateTransaction with complex key as file key
  // This means signing requires satisfying the threshold structure
  const tx = new FileCreateTransaction()
    .setKeys([complexKey.adminKey]) // Complex KeyList as file key
    .setContents(`Complex key performance test file ${index}`)
    .setNodeAccountIds([AccountId.fromString('0.0.3')])
    .setTransactionValidDuration(120)
    // Type assertion: freezeWith() expects Client but we use minimal mock object
    // with just operatorAccountId and network for transaction freezing without a real client
    .freezeWith({
      operatorAccountId: AccountId.fromString('0.0.2'),
      network: { '0.0.3': 'localhost:50211' },
    } as never);

  const unsignedBytes = tx.toBytes();
  const txId = tx.transactionId?.toString() || `0.0.2@${Math.floor(now.getTime() / 1000)}.${index}`;
  const txHash = crypto.createHash('sha256').update(unsignedBytes).digest('hex');

  return {
    transactionBytes: Buffer.from(unsignedBytes),
    unsignedTransactionBytes: Buffer.from(unsignedBytes),
    transactionId: txId,
    transactionHash: txHash,
    validStart: validStart,
    signature: Buffer.alloc(0),
  };
}

/**
 * Seed transactions that require complex threshold key signatures.
 * Creates a transaction group with transactions requiring the complex key.
 *
 * @param client - PostgreSQL client
 * @param complexKey - ComplexKeyResult with keys and metadata
 * @param creatorKeyId - Any user_key ID (for creatorKeyId FK constraint)
 * @param count - Number of transactions to create
 * @returns Transaction IDs for the seeded transactions
 */
export async function seedComplexKeyTransactions(
  client: Client,
  complexKey: ComplexKeyResult,
  creatorKeyId: number,
  count: number = 100,
): Promise<number[]> {
  console.log(`\nSeeding ${count} transactions requiring complex threshold key signatures...`);

  const transactionIds: number[] = [];
  const indexOffset = 10000; // High offset to avoid collisions with other seeds

  const groupResult: QueryResult<{ id: number }> = await client.query(
    `INSERT INTO "transaction_group" (description, atomic, sequential, "createdAt")
     VALUES ($1, $2, $3, NOW())
     RETURNING id`,
    [`${SEED_MARKER}-complex-key-group`, false, false],
  );
  const groupId = groupResult.rows[0].id;
  console.log(`  Created transaction_group: ${groupId}`);

  for (let i = 0; i < count; i++) {
    const txData = createComplexKeyTransaction(indexOffset + i, complexKey);

    const result: QueryResult<TransactionRow> = await client.query(
      `INSERT INTO "transaction" (
         name, type, description, "transactionId", "transactionHash",
         "transactionBytes", "unsignedTransactionBytes", status,
         "creatorKeyId", signature, "validStart", "mirrorNetwork",
         "isManual", "executedAt", "createdAt", "updatedAt"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
       RETURNING id`,
      [
        `Complex Key Tx ${i + 1}`,
        'FILE CREATE',
        `${SEED_MARKER}-complex-tx-${i}`,
        txData.transactionId,
        txData.transactionHash,
        txData.transactionBytes,
        txData.unsignedTransactionBytes,
        'WAITING FOR SIGNATURES',
        creatorKeyId,
        txData.signature,
        txData.validStart,
        MIRROR_NETWORK,
        false,
        null,
      ],
    );

    transactionIds.push(result.rows[0].id);

    // Link to group
    await client.query(
      `INSERT INTO "transaction_group_item" (seq, "transactionId", "groupId")
       VALUES ($1, $2, $3)`,
      [i, result.rows[0].id, groupId],
    );

    if (DEBUG && ((i + 1) % 25 === 0 || i === count - 1)) {
      console.log(`  Created ${i + 1}/${count} complex key transactions`);
    }
  }

  console.log(`  Completed: 1 group with ${count} complex key transactions`);
  return transactionIds;
}

/**
 * Clean up ALL seed data globally (not per-user).
 * Call this ONCE before seeding multiple users to avoid wiping previous users' data.
 */
async function cleanupAllSeedData(client: Client): Promise<void> {
  console.log('Cleaning up ALL previous seed data...');

  await client.query(
    `DELETE FROM transaction_group_item
     WHERE "transactionId" IN (
       SELECT id FROM "transaction" WHERE description LIKE $1
     )`,
    [`${SEED_MARKER}%`],
  );

  await client.query(
    `DELETE FROM transaction_group WHERE description LIKE $1`,
    [`${SEED_MARKER}%`],
  );

  await client.query(
    `DELETE FROM transaction_signer
     WHERE "transactionId" IN (
       SELECT id FROM "transaction" WHERE description LIKE $1
     )`,
    [`${SEED_MARKER}%`],
  );

  await client.query(
    `DELETE FROM transaction_approver
     WHERE "transactionId" IN (
       SELECT id FROM "transaction" WHERE description LIKE $1
     )`,
    [`${SEED_MARKER}%`],
  );

  // Clean up transaction_cached_account links for seed transactions
  await client.query(
    `DELETE FROM transaction_cached_account
     WHERE "transactionId" IN (
       SELECT id FROM "transaction" WHERE description LIKE $1
     )`,
    [`${SEED_MARKER}%`],
  );

  const txResult = await client.query(
    `DELETE FROM "transaction" WHERE description LIKE $1`,
    [`${SEED_MARKER}%`],
  );

  console.log(`Deleted ${txResult.rowCount} previous seed transactions`);
}

/**
 * Clean up user keys for a specific user.
 * Ensures clean state for Account Setup - user will need to import mnemonic.
 */
async function cleanupUserKeys(client: Client, userId: number): Promise<void> {
  const keyResult = await client.query(
    `DELETE FROM user_key WHERE "userId" = $1`,
    [userId],
  );
  if (keyResult.rowCount && keyResult.rowCount > 0) {
    console.log(`Deleted ${keyResult.rowCount} user keys for user ${userId}`);
  }
}

/**
 * Create a real FileCreateTransaction with proper transaction bytes
 * IMPORTANT: Store UNSIGNED bytes so transactions appear in /transactions/sign
 */
function createFileCreateTransaction(index: number): {
  transactionBytes: Buffer;
  unsignedTransactionBytes: Buffer;
  transactionId: string;
  transactionHash: string;
  validStart: Date;
  signature: Buffer;
} {
  const now = new Date();

  // Create a FileCreateTransaction with the test public key as the file key
  // This means the transaction requires signing by our test key
  const tx = new FileCreateTransaction()
    .setKeys([testPrivateKey.publicKey])
    .setContents(`Performance test file ${index}`)
    .setNodeAccountIds([AccountId.fromString('0.0.3')])
    .setTransactionValidDuration(120)
    // Type assertion: freezeWith() expects Client but we use minimal mock object
    // with just operatorAccountId and network for transaction freezing without a real client
    .freezeWith({
      operatorAccountId: AccountId.fromString('0.0.2'),
      network: { '0.0.3': 'localhost:50211' },
    } as never);

  // Get unsigned transaction bytes - DO NOT SIGN
  // Storing unsigned bytes ensures transactions appear in /transactions/sign
  const unsignedBytes = tx.toBytes();

  const txId = tx.transactionId?.toString() || `0.0.2@${Math.floor(now.getTime() / 1000)}.${index}`;

  const txHash = crypto.createHash('sha256').update(unsignedBytes).digest('hex');

  const signatureBytes = Buffer.alloc(0);

  return {
    // Store UNSIGNED bytes in both fields - transaction needs signing
    transactionBytes: Buffer.from(unsignedBytes),
    unsignedTransactionBytes: Buffer.from(unsignedBytes),
    transactionId: txId,
    transactionHash: txHash,
    validStart: now,
    signature: signatureBytes,
  };
}

interface InsertTransactionOptions {
  client: Client;
  index: number;
  status: string;
  creatorKeyId: number;
  executedAt?: Date | null;
  useRealTx?: boolean;
  name?: string;
  descriptionSuffix?: string;
  /** Offset in seconds to add to validStart (for sorting group transactions to page 1) */
  validStartOffsetSeconds?: number;
  /** CachedAccountId to link transaction to (required for /transaction-nodes endpoint) */
  cachedAccountId?: number;
}

interface InsertTransactionResult {
  id: number;
  signData?: SignTransactionData;
}

async function insertTransaction(
  options: InsertTransactionOptions,
): Promise<InsertTransactionResult> {
  const {
    client,
    index,
    status,
    creatorKeyId,
    executedAt = null,
    useRealTx = false,
    name = `Perf Test ${index}`,
    descriptionSuffix = `${index}`,
    validStartOffsetSeconds = 0,
    cachedAccountId,
  } = options;

  let transactionBytes: Buffer;
  let unsignedTransactionBytes: Buffer;
  let transactionId: string;
  let transactionHash: string;
  let validStart: Date;
  let signature: Buffer;

  if (useRealTx) {
    // Create real Hedera transaction bytes
    const txData = createFileCreateTransaction(index);
    transactionBytes = txData.transactionBytes;
    unsignedTransactionBytes = txData.unsignedTransactionBytes;
    transactionId = txData.transactionId;
    transactionHash = txData.transactionHash;
    validStart = txData.validStart;
    signature = txData.signature;
  } else {
    // Use dummy bytes for history (no signing required)
    transactionId = generateTransactionId(index);
    transactionHash = generateTransactionHash();
    validStart = new Date();
    transactionBytes = Buffer.from('dummy-tx-bytes');
    unsignedTransactionBytes = Buffer.from('dummy-unsigned-bytes');
    signature = Buffer.from('dummy-signature');
  }

  // Apply offset to validStart (used to ensure group transactions appear on page 1)
  if (validStartOffsetSeconds !== 0) {
    validStart = new Date(validStart.getTime() + validStartOffsetSeconds * 1000);
  }

  const result: QueryResult<TransactionRow> = await client.query(
    `INSERT INTO "transaction" (
       name, type, description, "transactionId", "transactionHash",
       "transactionBytes", "unsignedTransactionBytes", status,
       "creatorKeyId", signature, "validStart", "mirrorNetwork",
       "isManual", "executedAt", "createdAt", "updatedAt"
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
     RETURNING id`,
    [
      name,
      'FILE CREATE',
      `${SEED_MARKER}-${Date.now()}-${descriptionSuffix}`,
      transactionId,
      transactionHash,
      transactionBytes,
      unsignedTransactionBytes,
      status,
      creatorKeyId,
      signature,
      validStart,
      MIRROR_NETWORK,
      false,
      executedAt,
    ],
  );

  const insertResult: InsertTransactionResult = { id: result.rows[0].id };

  // Link transaction to cached account (required for /transaction-nodes endpoint)
  if (cachedAccountId) {
    await client.query(
      `INSERT INTO transaction_cached_account ("transactionId", "cachedAccountId")
       VALUES ($1, $2)
       ON CONFLICT ("transactionId", "cachedAccountId") DO NOTHING`,
      [insertResult.id, cachedAccountId],
    );
  }

  // Return transaction data for signature generation when using real transactions
  if (useRealTx) {
    insertResult.signData = {
      transactionId,
      unsignedBytes: unsignedTransactionBytes,
    };
  }

  return insertResult;
}

async function seedSignTransactions(
  client: Client,
  userKeyId: number,
  cachedAccountId: number,
): Promise<void> {
  console.log(`\nSeeding ${SIGN_COUNT} transactions for /transactions/sign...`);
  console.log('  (Using real Hedera SDK transactions - this may take a moment)');

  signTransactionsData.length = 0;

  for (let i = 0; i < SIGN_COUNT; i++) {
    const result = await insertTransaction({
      client,
      index: i,
      status: 'WAITING FOR SIGNATURES',
      creatorKeyId: userKeyId,
      useRealTx: true,
      cachedAccountId,
    });

    // Collect for signature generation
    if (result.signData) {
      signTransactionsData.push(result.signData);
    }

    // NOTE: transaction_cached_account link is created by insertTransaction
    // This is required for /transaction-nodes?collection=READY_TO_SIGN endpoint

    if ((i + 1) % 50 === 0) {
      console.log(`  Created ${i + 1}/${SIGN_COUNT} sign transactions`);
    }
  }

  console.log(`  Completed: ${SIGN_COUNT} sign transactions`);
}

async function seedHistoryTransactions(
  client: Client,
  userKeyId: number,
  cachedAccountId: number,
): Promise<void> {
  console.log(`\nSeeding ${HISTORY_COUNT} transactions for /transactions/history...`);

  for (let i = 0; i < HISTORY_COUNT; i++) {
    const status = HISTORY_STATUSES[i % HISTORY_STATUSES.length];
    const executedAt = status === 'EXECUTED' ? new Date() : null;

    await insertTransaction({
      client,
      index: SIGN_COUNT + i, // Offset to avoid transactionId collisions
      status,
      creatorKeyId: userKeyId,
      executedAt,
      useRealTx: true, // Dummy bytes cause "invalid wire type" protobuf errors
      cachedAccountId,
    });

    if ((i + 1) % 100 === 0) {
      console.log(`  Created ${i + 1}/${HISTORY_COUNT} history transactions`);
    }
  }

  console.log(`  Completed: ${HISTORY_COUNT} history transactions`);
}

async function seedApproveTransactions(
  client: Client,
  userId: number,
  userKeyId: number,
  cachedAccountId: number,
): Promise<void> {
  console.log(`\nSeeding ${APPROVE_COUNT} transactions for /transactions/approve...`);
  console.log('  (Using real Hedera SDK transactions)');

  for (let i = 0; i < APPROVE_COUNT; i++) {
    const result = await insertTransaction({
      client,
      index: SIGN_COUNT + HISTORY_COUNT + i,
      status: 'WAITING FOR SIGNATURES',
      creatorKeyId: userKeyId,
      useRealTx: true,
      cachedAccountId,
    });

    // Collect for signature generation (approve transactions also appear in /transactions/sign)
    if (result.signData) {
      signTransactionsData.push(result.signData);
    }

    // Create transaction_approver entry with approved = NULL
    await client.query(
      `INSERT INTO transaction_approver (
         "transactionId", "userId", approved, "createdAt", "updatedAt"
       )
       VALUES ($1, $2, NULL, NOW(), NOW())`,
      [result.id, userId],
    );

    if ((i + 1) % 25 === 0) {
      console.log(`  Created ${i + 1}/${APPROVE_COUNT} approve transactions`);
    }
  }

  console.log(`  Completed: ${APPROVE_COUNT} approve transactions`);
}

interface GroupRow {
  id: number;
}

/**
 * Seed a transaction group for Sign All button testing
 * Creates one group with GROUP_SIZE transactions linked to it
 */
async function seedTransactionGroups(
  client: Client,
  userKeyId: number,
  cachedAccountId: number,
): Promise<void> {
  console.log(`\nSeeding transaction group with ${GROUP_SIZE} transactions for Sign All...`);
  console.log('  (Using real Hedera SDK transactions)');

  // Calculate offset to avoid ID collisions with other seeded transactions
  const indexOffset = SIGN_COUNT + HISTORY_COUNT + APPROVE_COUNT;

  // Use a past timestamp to ensure group transactions appear on page 1
  // The Ready to Sign list is sorted by validStart ASC, so older timestamps come first
  const GROUP_TIMESTAMP_OFFSET_SECONDS = -3600; // 1 hour in the past

  const groupResult: QueryResult<GroupRow> = await client.query(
    `INSERT INTO "transaction_group" (description, atomic, sequential, "createdAt")
     VALUES ($1, $2, $3, NOW())
     RETURNING id`,
    [`${SEED_MARKER}-group`, false, false],
  );
  const groupId = groupResult.rows[0].id;
  console.log(`  Created transaction_group: ${groupId}`);

  const transactionIds: number[] = [];

  for (let i = 0; i < GROUP_SIZE; i++) {
    const result = await insertTransaction({
      client,
      index: indexOffset + i,
      status: 'WAITING FOR SIGNATURES',
      creatorKeyId: userKeyId,
      useRealTx: true,
      name: `Group Tx ${i + 1}`,
      descriptionSuffix: `group-item-${i}`,
      validStartOffsetSeconds: GROUP_TIMESTAMP_OFFSET_SECONDS,
      cachedAccountId,
    });

    transactionIds.push(result.id);

    // Collect for signature generation (group transactions also need signing)
    if (result.signData) {
      signTransactionsData.push(result.signData);
    }
  }

  for (let i = 0; i < transactionIds.length; i++) {
    await client.query(
      `INSERT INTO "transaction_group_item" (seq, "transactionId", "groupId")
       VALUES ($1, $2, $3)`,
      [i, transactionIds[i], groupId],
    );
  }

  console.log(`  Completed: 1 group with ${GROUP_SIZE} transactions (IDs: ${transactionIds[0]}-${transactionIds[transactionIds.length - 1]})`);
}

/**
 * Seed transactions with WAITING FOR EXECUTION status
 * These appear in the "Ready for Execution" tab
 */
async function seedReadyForExecutionTransactions(
  client: Client,
  userKeyId: number,
  cachedAccountId: number,
): Promise<void> {
  console.log(`\nSeeding ${EXECUTION_COUNT} transactions for Ready for Execution tab...`);
  console.log('  (Using real Hedera SDK transactions)');

  // Calculate offset to avoid ID collisions with other seeded transactions
  const indexOffset = SIGN_COUNT + HISTORY_COUNT + APPROVE_COUNT + GROUP_SIZE;

  for (let i = 0; i < EXECUTION_COUNT; i++) {
    const result = await insertTransaction({
      client,
      index: indexOffset + i,
      status: 'WAITING FOR EXECUTION',
      creatorKeyId: userKeyId,
      useRealTx: true,
      descriptionSuffix: `execution-${i}`,
      cachedAccountId,
    });

    // Collect for signature generation (needed for sign-all test)
    if (result.signData) {
      signTransactionsData.push(result.signData);
    }

    if ((i + 1) % 25 === 0) {
      console.log(`  Created ${i + 1}/${EXECUTION_COUNT} execution transactions`);
    }
  }

  console.log(`  Completed: ${EXECUTION_COUNT} Ready for Execution transactions`);
}

/**
 * Convert SDK SignatureMap to backend JSON format using public iterators
 * Backend expects: { nodeAccountId: { transactionId: { derPublicKey: "0x" + signatureHex }}}
 *
 * Note: Similar function exists in sign-transactions.ts with strict Map types.
 * This version uses Iterable<[unknown, unknown]> for compatibility with SDK's SignatureMap
 * which doesn't expose typed iteration methods.
 */
function signatureMapToBackendFormat(signatureMap: Iterable<[unknown, unknown]>): SignatureMap {
  const result: SignatureMap = {};

  for (const [nodeAccountId, nodeMap] of signatureMap) {
    const nodeId = String(nodeAccountId);
    result[nodeId] = {};
    for (const [transactionId, pkMap] of nodeMap as Iterable<[unknown, unknown]>) {
      const txId = String(transactionId);
      result[nodeId][txId] = {};
      for (const [publicKey, signature] of pkMap as Iterable<[unknown, Uint8Array]>) {
        const pk = String(publicKey);
        result[nodeId][txId][pk] = '0x' + Buffer.from(signature).toString('hex');
      }
    }
  }

  return result;
}

/**
 * Generate signatures.json for sign-all.ts PRE_SIGNED mode
 * Uses PrivateKey.signTransaction() and public iterators (no internal SDK access)
 */
function generateSignaturesFile(): void {
  if (signTransactionsData.length === 0) {
    console.log('\nNo sign transactions to generate signatures for');
    return;
  }

  console.log(`\nGenerating signatures for ${signTransactionsData.length} transactions...`);

  const signaturesByTxId: Record<string, SignatureMap> = {};

  for (const { transactionId, unsignedBytes } of signTransactionsData) {
    const tx = Transaction.fromBytes(unsignedBytes);
    const signatureMap = testPrivateKey.signTransaction(tx);
    signaturesByTxId[transactionId] = signatureMapToBackendFormat(signatureMap);
  }

  // Ensure data directory exists
  const dataDir = path.join(__dirname, '../data');
  fs.mkdirSync(dataDir, { recursive: true });

  // Write signatures file
  const signaturesPath = path.join(dataDir, 'signatures.json');
  fs.writeFileSync(
    signaturesPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: Object.keys(signaturesByTxId).length,
        signaturesByTxId,
      },
      null,
      2,
    ),
  );

  console.log(`  Saved signatures to: ${signaturesPath}`);
}

function savePrivateKey(): void {
  const dataDir = path.join(__dirname, '../data');
  fs.mkdirSync(dataDir, { recursive: true });

  const keyPath = path.join(dataDir, 'test-private-key.txt');
  fs.writeFileSync(keyPath, testPrivateKey.toStringRaw());
  console.log(`  Saved private key to: ${keyPath}`);

  // Save mnemonic for Account Setup import during UI tests
  const mnemonicPath = path.join(dataDir, 'test-mnemonic.txt');
  fs.writeFileSync(mnemonicPath, testMnemonic.toString());
  console.log(`  Saved mnemonic to: ${mnemonicPath}`);
}

interface CountRow {
  count: string;
}

/**
 * Validate that seeded data matches expected volumes
 * Helps catch partial failures and volume mismatches
 */
async function validateSeededData(client: Client): Promise<void> {
  console.log('\nValidating seeded data...');

  const checks: Array<{ name: string; query: string; params: string[]; expected: number }> = [
    {
      name: 'Sign transactions',
      query: `SELECT COUNT(*) as count FROM "transaction" WHERE description LIKE $1 AND status = 'WAITING FOR SIGNATURES' AND description NOT LIKE $2`,
      params: [`${SEED_MARKER}%`, `%group-item%`],
      expected: SIGN_COUNT + APPROVE_COUNT, // Both types are WAITING FOR SIGNATURES
    },
    {
      name: 'History transactions',
      query: `SELECT COUNT(*) as count FROM "transaction" WHERE description LIKE $1 AND status IN ('EXECUTED', 'FAILED', 'EXPIRED', 'CANCELED', 'ARCHIVED')`,
      params: [`${SEED_MARKER}%`],
      expected: HISTORY_COUNT,
    },
    {
      name: 'Approve transactions',
      query: `SELECT COUNT(*) as count FROM transaction_approver WHERE "transactionId" IN (SELECT id FROM "transaction" WHERE description LIKE $1)`,
      params: [`${SEED_MARKER}%`],
      expected: APPROVE_COUNT,
    },
    {
      name: 'Group transactions',
      query: `SELECT COUNT(*) as count FROM "transaction" WHERE description LIKE $1`,
      params: [`${SEED_MARKER}%-group-item%`],
      expected: GROUP_SIZE,
    },
    {
      name: 'Transaction groups',
      query: `SELECT COUNT(*) as count FROM transaction_group WHERE description LIKE $1`,
      params: [`${SEED_MARKER}%`],
      expected: 1,
    },
    {
      name: 'Ready for Execution transactions',
      query: `SELECT COUNT(*) as count FROM "transaction" WHERE description LIKE $1 AND status = 'WAITING FOR EXECUTION'`,
      params: [`${SEED_MARKER}%`],
      expected: EXECUTION_COUNT,
    },
  ];

  let allPassed = true;
  for (const { name, query, params, expected } of checks) {
    const result: QueryResult<CountRow> = await client.query(query, params);
    const actual = Number.parseInt(result.rows[0].count, 10);
    const passed = actual >= expected;
    const status = passed ? '✓' : '✗';
    console.log(`  ${status} ${name}: ${actual}/${expected}`);
    if (!passed) allPassed = false;
  }

  if (!allPassed) {
    console.warn('\n⚠️  Some volume checks failed. Tests may not have enough data.');
  }
}

/**
 * Seed data for a single user.
 * Creates user_key and transactions for the specified email.
 * Requires initializeKeyPair() to be called first.
 * NOTE: Call cleanupAllSeedData() ONCE before calling this for multiple users.
 *
 * @param cachedAccountId - The ID of the cached account to link transactions to
 */
async function seedDataForUser(client: Client, email: string, cachedAccountId: number): Promise<void> {
  // Find test user
  const userResult: QueryResult<UserRow> = await client.query(
    'SELECT id FROM "user" WHERE email = $1',
    [email],
  );

  if (userResult.rows.length === 0) {
    console.error(`Error: User ${email} not found`);
    console.log('\nCreate the test user first:');
    console.log(
      `  TEST_USER_EMAIL='${email}' TEST_USER_PASSWORD='yourpassword' npx tsx k6/helpers/seed-test-users.ts`,
    );
    throw new Error(`User ${email} not found`);
  }

  const userId = userResult.rows[0].id;
  console.log(`\n--- Seeding data for user: ${email} (id: ${userId}) ---`);

  // Clean up user keys only (transaction cleanup happens globally before the loop)
  await cleanupUserKeys(client, userId);

  // Create new user key with the generated keypair (shared across all pool users)
  const userKeyId = await findOrCreateUserKey(client, userId);

  await seedSignTransactions(client, userKeyId, cachedAccountId);
  await seedHistoryTransactions(client, userKeyId, cachedAccountId);
  await seedApproveTransactions(client, userId, userKeyId, cachedAccountId);
  await seedTransactionGroups(client, userKeyId, cachedAccountId);
  await seedReadyForExecutionTransactions(client, userKeyId, cachedAccountId);
}

async function seedData(): Promise<void> {
  // Initialize keypair for signing transactions (ONCE - shared across all users)
  await initializeKeyPair();

  const dbConfig = getDbConfig();
  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log(`Connected to PostgreSQL (${dbConfig.host}:${dbConfig.port}) - database: ${dbConfig.database}`);

    const usersToSeed: string[] = [];

    if (process.env.SEED_POOL === 'true') {
      console.log(`\nSEED_POOL mode: seeding ${TEST_USER_POOL.length} users`);
      for (const poolUser of TEST_USER_POOL) {
        usersToSeed.push(poolUser.email);
      }
    } else {
      usersToSeed.push(getTestUserEmail());
    }

    // CLEANUP ONCE before seeding any users (prevents wiping earlier users' data)
    await cleanupAllSeedData(client);

    // Seed CachedAccount so backend uses test key instead of querying Mirror Node
    // This is required for Ready to Sign tests - fee payer 0.0.2 needs test key
    // Also creates cached_account_key for the optimized /transaction-nodes endpoint
    const cachedAccountId = await seedCachedAccount(client, testPublicKeyHex);

    // Seed data for each user (user keys cleaned per-user, transactions not)
    for (const email of usersToSeed) {
      await seedDataForUser(client, email, cachedAccountId);
    }

    // Generate signatures.json for PRE_SIGNED mode (all users' transactions)
    generateSignaturesFile();

    // Save private key for debugging/manual signing (shared across all users)
    savePrivateKey();

    await validateSeededData(client);

    const txPerUser = SIGN_COUNT + HISTORY_COUNT + APPROVE_COUNT + GROUP_SIZE + EXECUTION_COUNT;
    const totalTx = txPerUser * usersToSeed.length;
    console.log('\n=== Seeding Complete ===');
    console.log(`Users seeded: ${usersToSeed.length}`);
    console.log(`Transactions per user: ${txPerUser}`);
    console.log(`Total transactions created: ${totalTx}`);
    console.log(`  Ready to Sign: ${SIGN_COUNT} per user`);
    console.log(`  History: ${HISTORY_COUNT} per user`);
    console.log(`  Ready to Approve: ${APPROVE_COUNT} per user`);
    console.log(`  Ready for Execution: ${EXECUTION_COUNT} per user`);
    console.log(`  Transaction group: 1 group with ${GROUP_SIZE} transactions per user`);

    if (usersToSeed.length === 1) {
      console.log('\nRun k6 tests with:');
      console.log('  npm run k6:tabs');
    } else {
      console.log('\nPool users ready for UI performance tests.');
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ECONNREFUSED') {
      console.error('Error: Cannot connect to PostgreSQL. Is Docker running?');
      console.log('\nStart the backend with: cd back-end && docker-compose up -d');
    } else {
      console.error('Error seeding data:', err.message);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Check if this module is being run directly
const isMainModule = process.argv[1] === __filename;
if (isMainModule) {
  await seedData();
}
