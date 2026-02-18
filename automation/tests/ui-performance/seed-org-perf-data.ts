/**
 * Org Mode Performance Data Seeder
 *
 * Seeds PostgreSQL database with test data for org-mode UI performance tests.
 * Wraps the k6 seed scripts to run them automatically from Playwright tests.
 *
 * This avoids the need to run `npm run k6:seed:all` manually before tests.
 */

import { execSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Page } from '@playwright/test';
import { Client } from 'pg';
import { TEST_USER_POOL, DATA_VOLUMES, COMPLEX_KEY, TEST_LOCAL_PASSWORD } from '../../k6/src/config/constants.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { OrganizationPage } from '../../pages/OrganizationPage.js';
import { DEBUG } from './performanceUtils.js';
import { PrivateKey } from '@hashgraph/sdk';
import {
  generateSimpleComplexKey,
  generateHederaStyleComplexKey,
  type ComplexKeyResult,
} from '../../k6/helpers/complex-keys.js';
import {
  seedComplexKeys,
  seedComplexKeyTransactions,
} from '../../k6/helpers/seed-perf-data.js';
import { openDatabase, closeDatabase } from '../../utils/databaseUtil.js';
import { encrypt, argonHash } from '../../utils/crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mirror network - parameterized for staging (testnet) vs local/prod (mainnet)
const MIRROR_NETWORK = process.env.HEDERA_NETWORK === 'testnet' ? 'testnet' : 'mainnet';

/**
 * Detect if running on staging environment.
 * Staging is identified by HEDERA_NETWORK=testnet or ORGANIZATION_URL containing 'staging'.
 */
function isStaging(): boolean {
  return (
    process.env.HEDERA_NETWORK === 'testnet' ||
    process.env.ORGANIZATION_URL?.includes('staging') === true
  );
}

/**
 * Staging complex keys loaded from environment variables.
 */
interface StagingComplexKeys {
  privateKeys: PrivateKey[];
  publicKeys: string[];
  metadata: {
    totalKeys: number;
    parentThreshold: number;
    childCount: number;
  };
}

/**
 * Load complex keys from staging environment variables.
 * These are set by running: npm run k6:bootstrap:complex:staging
 *
 * @returns StagingComplexKeys with privateKeys and metadata
 * @throws Error if required env vars are missing
 */
function loadStagingComplexKeys(): StagingComplexKeys {
  const privateKeysBase64 = process.env.COMPLEX_KEY_PRIVATE_KEYS;
  if (!privateKeysBase64) {
    throw new Error(
      'COMPLEX_KEY_PRIVATE_KEYS not set. Run k6:bootstrap:complex:staging first.',
    );
  }

  const privateKeyHexArray = JSON.parse(
    Buffer.from(privateKeysBase64, 'base64').toString(),
  ) as string[];

  const privateKeys = privateKeyHexArray.map((hex) =>
    PrivateKey.fromStringED25519(hex),
  );
  const publicKeys = privateKeys.map((pk) => pk.publicKey.toStringRaw());

  return {
    privateKeys,
    publicKeys,
    metadata: {
      totalKeys: process.env.COMPLEX_KEY_TOTAL
        ? Number.parseInt(process.env.COMPLEX_KEY_TOTAL, 10)
        : COMPLEX_KEY.TOTAL_KEYS,
      parentThreshold: process.env.COMPLEX_KEY_THRESHOLD
        ? Number.parseInt(process.env.COMPLEX_KEY_THRESHOLD, 10)
        : COMPLEX_KEY.PARENT_THRESHOLD,
      childCount: COMPLEX_KEY.CHILD_COUNT,
    },
  };
}

/**
 * Insert private keys into SQLite KeyPair table.
 * Common helper used by both staging and local key seeding.
 *
 * @param privateKeys - Array of PrivateKey objects to seed
 * @param localPassword - Password for encrypting private keys
 * @param secretHash - Hash to use (must match PostgreSQL user_key.mnemonicHash)
 * @param organizationUserId - PostgreSQL user ID (links SQLite to backend user_key)
 * @param label - Label for logging (e.g., "staging keys", "complex keys")
 */
async function insertKeysToSQLite(
  privateKeys: PrivateKey[],
  localPassword: string,
  secretHash: string,
  organizationUserId: number,
  label: string,
): Promise<void> {
  const db = openDatabase();
  if (!db) {
    throw new Error('SQLite database not found - app must be launched first');
  }

  console.log(`\nSeeding ${privateKeys.length} ${label} to SQLite KeyPair...`);

  try {
    for (let i = 0; i < privateKeys.length; i++) {
      const privateKey = privateKeys[i];
      const publicKey = privateKey.publicKey.toStringRaw();
      const encryptedKey = encrypt(privateKey.toStringRaw(), localPassword);

      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO KeyPair (id, user_id, "index", public_key, private_key,
                               type, organization_id, secret_hash, organization_user_id)
           VALUES (?,
                   (SELECT id FROM User WHERE email != 'keychain@mode' LIMIT 1),
                   ?, ?, ?, 'ED25519',
                   (SELECT id FROM Organization LIMIT 1),
                   ?, ?)`,
          [crypto.randomUUID(), i, publicKey, encryptedKey, secretHash, organizationUserId],
          function (err) {
            if (err) reject(err);
            else resolve();
          },
        );
      });

      if ((i + 1) % 20 === 0 || i === privateKeys.length - 1) {
        if (DEBUG) console.log(`  Inserted ${i + 1}/${privateKeys.length} ${label} to SQLite`);
      }
    }

    console.log(`  Completed: ${privateKeys.length} ${label} in SQLite KeyPair`);
  } finally {
    closeDatabase(db);
  }
}

/**
 * Seed staging complex keys to SQLite only.
 * On staging, PostgreSQL already has keys from bootstrap script.
 */
async function seedStagingComplexKeysToSQLite(
  privateKeys: PrivateKey[],
  localPassword: string,
  secretHash: string,
  organizationUserId: number,
): Promise<void> {
  return insertKeysToSQLite(privateKeys, localPassword, secretHash, organizationUserId, 'staging keys');
}

/**
 * Get a test user from the pool based on test name.
 * Distributes tests across users to avoid rate limiting (3 logins/min per email).
 * Uses simple hash of test name for consistent user assignment.
 *
 * @param testName - Unique test identifier (e.g., 'perf-history', 'perf-sign-all')
 * @returns User credentials from the pool
 */
export function getPooledTestUser(testName: string): { email: string; password: string } {
  const hash = testName.split('').reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), 0);
  const index = hash % TEST_USER_POOL.length;
  return TEST_USER_POOL[index];
}

interface SeedResult {
  userCreated: boolean;
  transactionsSeeded: boolean;
  mnemonicPath: string | null;
}

/**
 * Seed the PostgreSQL database with k6 test user and transactions.
 * Equivalent to running: npm run k6:seed:all
 *
 * This function:
 * 1. Creates the k6 test user if not exists
 * 2. Seeds transactions (sign, history, approve)
 * 3. Generates mnemonic for Account Setup import
 */
export async function seedOrgPerfData(): Promise<SeedResult> {
  const automationDir = path.resolve(__dirname, '../..');
  const mnemonicPath = path.join(__dirname, '../../k6/data/test-mnemonic.txt');

  if (DEBUG) console.log('Seeding org-mode performance test data...');

  try {
    if (DEBUG) console.log('  Creating pool users...');
    execSync('npx tsx k6/helpers/seed-test-users.ts', {
      cwd: automationDir,
      stdio: 'inherit',
      timeout: 120000, // 2 minutes
      env: {
        ...process.env,
        SEED_POOL: 'true',
      },
    });

    if (DEBUG) console.log('  Seeding transactions for all pool users...');
    execSync('npx tsx k6/helpers/seed-perf-data.ts', {
      cwd: automationDir,
      stdio: 'inherit',
      timeout: 300000, // 5 minutes (seeding many transactions)
      env: {
        ...process.env,
        SEED_POOL: 'true',
      },
    });

    if (!fs.existsSync(mnemonicPath)) {
      throw new Error(`Mnemonic file not found at ${mnemonicPath}`);
    }

    if (DEBUG) console.log('  Org-mode data seeding complete!');

    return {
      userCreated: true,
      transactionsSeeded: true,
      mnemonicPath,
    };
  } catch (error) {
    console.error('Error seeding org-mode data:', error);
    throw error;
  }
}

export function readSeedMnemonic(): string[] {
  const mnemonicPath = path.join(__dirname, '../../k6/data/test-mnemonic.txt');

  if (!fs.existsSync(mnemonicPath)) {
    throw new Error(
      `Mnemonic file not found. Run seedOrgPerfData() first or: npm run k6:seed:all`,
    );
  }

  const mnemonic = fs.readFileSync(mnemonicPath, 'utf-8').trim();
  const words = mnemonic.split(' ');

  if (words.length !== 24) {
    throw new Error(`Invalid mnemonic: expected 24 words, got ${words.length}`);
  }

  return words;
}

/**
 * Import the seed mnemonic via the Recovery Phrase import flow.
 * Extracts duplicated mnemonic import logic from org-mode tests (DRY).
 */
export async function importSeedMnemonic(
  window: Page,
  registrationPage: RegistrationPage,
): Promise<void> {
  await registrationPage.waitForElementToBeVisible(registrationPage.createNewTabSelector);
  if (DEBUG) console.log('Account Setup screen visible, importing seed mnemonic...');

  const words = readSeedMnemonic();
  if (DEBUG) console.log(`Read mnemonic with ${words.length} words`);

  await registrationPage.clickOnImportTab();

  for (let i = 0; i < 24; i++) {
    await registrationPage.fillRecoveryPhraseWord(i + 1, words[i]);
  }

  await registrationPage.scrollToNextImportButton();
  await registrationPage.clickOnNextImportButton();

  // Wait for Key Pairs screen (button-next-import disappears)
  await window.waitForSelector('[data-testid="button-next-import"]', { state: 'hidden', timeout: 10000 });
  if (DEBUG) console.log('On Key Pairs screen');

  await registrationPage.waitForElementToDisappear(registrationPage.toastMessageSelector);
  await registrationPage.clickOnFinalNextButtonWithRetry();
  if (DEBUG) console.log('Account Setup completed');
}

/**
 * Full org-mode test environment setup.
 * Extracts duplicated setup logic from org-mode tests (DRY).
 *
 * This function:
 * 1. Seeds org data (user + transactions + mnemonic)
 * 2. Registers locally with unique email
 * 3. Connects to organization and signs in as k6 user
 * 4. Imports the seed mnemonic to complete Account Setup
 */
export async function setupOrgModeTestEnvironment(
  window: Page,
  registrationPage: RegistrationPage,
  organizationPage: OrganizationPage,
  testNamePrefix: string,
): Promise<void> {
  await seedOrgPerfData();

  const localPassword = TEST_LOCAL_PASSWORD;
  await registrationPage.completeRegistration(
    `${testNamePrefix}-${Date.now()}@test.com`,
    localPassword,
  );

  // Uses different email per test to avoid backend rate limiting (3 logins/min per email)
  const pooledUser = getPooledTestUser(testNamePrefix);
  await organizationPage.setupOrganization();
  await organizationPage.waitForElementToBeVisible(
    organizationPage.emailForOrganizationInputSelector,
  );
  await organizationPage.signInOrganization(pooledUser.email, pooledUser.password, localPassword);

  await importSeedMnemonic(window, registrationPage);
}

function createPgClient(): Client {
  return new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number.parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DATABASE || 'postgres',
    user: process.env.POSTGRES_USERNAME || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  });
}

/**
 * Refresh the CachedAccount with the correct test key.
 *
 * The backend has a 10-second TTL for cached accounts. If more than 10s passes
 * between seeding and the Ready to Sign request, the cache expires and the
 * backend refreshes from Mirror Node, overwriting our test key with Hedera's.
 *
 * This function:
 * 1. Reads the test mnemonic from disk
 * 2. Derives the public key
 * 3. Re-inserts the cached_account with the correct key and fresh timestamp
 *
 * Call this RIGHT BEFORE navigating to Ready to Sign tab.
 *
 * @param client - Connected PostgreSQL client (or creates one if not provided)
 */
export async function refreshCachedAccountTimestamp(client?: Client): Promise<void> {
  const shouldClose = !client;
  const pgClient = client || createPgClient();

  try {
    if (!client) {
      await pgClient.connect();
    }

    // Read the test mnemonic and derive the public key
    const { Mnemonic } = await import('@hashgraph/sdk');
    const { proto } = await import('@hashgraph/proto');

    const mnemonicWords = readSeedMnemonic();
    const mnemonic = await Mnemonic.fromString(mnemonicWords.join(' '));
    const privateKey = await mnemonic.toStandardEd25519PrivateKey();
    const publicKey = privateKey.publicKey;

    // Serialize to protobuf
    const protoKey = (publicKey as unknown as { _toProtobufKey: () => unknown })._toProtobufKey();
    const encodedKey = Buffer.from(proto.Key.encode(protoKey as Parameters<typeof proto.Key.encode>[0]).finish());

    // UPDATE instead of DELETE+INSERT to preserve cascade-dependent rows:
    // - cached_account_key (required for signer key matching)
    // - transaction_cached_account (links each transaction to this account)
    // Deleting would cascade-destroy thousands of transaction links.
    await pgClient.query(
      `UPDATE cached_account
       SET "encodedKey" = $1, "updatedAt" = NOW()
       WHERE account = $2 AND "mirrorNetwork" = $3`,
      [encodedKey, '0.0.2', MIRROR_NETWORK],
    );

    if (DEBUG) console.log(`✓ Refreshed CachedAccount for 0.0.2 with key ${publicKey.toStringRaw().slice(0, 16)}...`);
  } finally {
    if (shouldClose) {
      await pgClient.end();
    }
  }
}

/**
 * Result from complex key seeding
 */
export interface ComplexKeySetupResult {
  complexKey: ComplexKeyResult;
  userKeyIds: number[];
  transactionIds: number[];
  userId: number;
  mnemonicHash: string;
}

/**
 * Seed complex keys into local SQLite KeyPair table.
 * This is required because the app signs using local SQLite keys, not PostgreSQL.
 *
 * @param complexKey - ComplexKeyResult with private keys to seed
 * @param localPassword - Password for encrypting private keys
 * @param secretHash - Hash to use (must match PostgreSQL user_key.mnemonicHash)
 * @param organizationUserId - PostgreSQL user ID (links SQLite to backend user_key)
 */
export async function seedComplexKeysToSQLite(
  complexKey: ComplexKeyResult,
  localPassword: string,
  secretHash: string,
  organizationUserId: number,
): Promise<void> {
  return insertKeysToSQLite(complexKey.allPrivateKeys, localPassword, secretHash, organizationUserId, 'complex keys');
}

/**
 * Seed complex threshold keys and transactions for a user.
 * This bypasses the mnemonic import flow and directly seeds keys into PostgreSQL.
 *
 * @param userEmail - Email of the user to seed keys for
 * @param useHederaStyle - If true, uses full 17-of-29 structure (72 keys). Default: simple 2-of-3 (6 keys).
 * @param transactionCount - Number of transactions to create (default: COMPLEX_KEY_GROUP_SIZE)
 * @returns ComplexKeySetupResult with keys, transaction IDs, and mnemonicHash
 */
export async function seedComplexKeyData(
  userEmail: string,
  useHederaStyle: boolean = false,
  transactionCount: number = DATA_VOLUMES.COMPLEX_KEY_GROUP_SIZE,
): Promise<ComplexKeySetupResult> {
  const client = createPgClient();

  try {
    await client.connect();
    if (DEBUG) console.log('Connected to PostgreSQL for complex key seeding');

    const userResult = await client.query(
      'SELECT id FROM "user" WHERE email = $1',
      [userEmail],
    );

    if (userResult.rows.length === 0) {
      throw new Error(`User ${userEmail} not found. Create user first with seed-test-users.ts`);
    }

    const userId = userResult.rows[0].id;
    if (DEBUG) console.log(`Found user ${userEmail} with ID ${userId}`);

    const complexKey = useHederaStyle ? generateHederaStyleComplexKey() : generateSimpleComplexKey();
    console.log(`Generated ${complexKey.metadata.totalKeys} complex threshold keys`);
    console.log(`  Structure: THRESHOLD (${complexKey.metadata.parentThreshold} of ${complexKey.metadata.childCount})`);

    // Generate a consistent hash for both PostgreSQL and SQLite
    // This allows accountSetupRequired() to pass
    const mnemonicHash = await argonHash('complex-key-seed-hash', true);

    const userKeyIds = await seedComplexKeys(client, userId, complexKey, mnemonicHash);

    const transactionIds = await seedComplexKeyTransactions(
      client,
      complexKey,
      userKeyIds[0], // Use first key as creatorKeyId
      transactionCount,
    );

    return {
      complexKey,
      userKeyIds,
      transactionIds,
      userId,
      mnemonicHash,
    };
  } finally {
    await client.end();
  }
}

/**
 * Setup org-mode test environment WITH complex threshold keys.
 * Similar to setupOrgModeTestEnvironment, but seeds multiple keys instead of mnemonic-derived key.
 *
 * This function seeds keys to BOTH PostgreSQL (user_key) and SQLite (KeyPair):
 * - PostgreSQL: Required for org key matching
 * - SQLite: Required for local signing (the app uses SQLite for private keys)
 *
 * On staging, keys are loaded from environment variables (pre-bootstrapped)
 * and only SQLite is seeded (PostgreSQL already has keys from bootstrap).
 */
export async function setupComplexKeyTestEnvironment(
  _window: Page,
  registrationPage: RegistrationPage,
  organizationPage: OrganizationPage,
  testNamePrefix: string,
  useHederaStyle: boolean = false,
): Promise<ComplexKeySetupResult> {
  const localPassword = TEST_LOCAL_PASSWORD;

  if (isStaging()) {
    // === STAGING PATH ===
    // Keys pre-created via k6:bootstrap:complex:staging
    // PostgreSQL already has user + user_key entries
    // Only need to seed SQLite for local signing

    console.log('Staging mode: Loading pre-bootstrapped complex keys...');

    const stagingKeys = loadStagingComplexKeys();
    console.log(`  Loaded ${stagingKeys.metadata.totalKeys} keys from env vars`);

    // Complete local registration
    await registrationPage.completeRegistration(
      `${testNamePrefix}-${Date.now()}@test.com`,
      localPassword,
    );

    await organizationPage.setupOrganization();
    await organizationPage.waitForElementToBeVisible(
      organizationPage.emailForOrganizationInputSelector,
    );

    const stagingEmail = process.env.STAGING_USER_EMAIL;
    const stagingPassword = process.env.STAGING_USER_PASSWORD;
    if (!stagingEmail || !stagingPassword) {
      throw new Error(
        'STAGING_USER_EMAIL and STAGING_USER_PASSWORD required for staging. ' +
        'Set these from your staging backend user.',
      );
    }

    // Generate hash for SQLite (must match what staging user has in PostgreSQL)
    const mnemonicHash = await argonHash('complex-key-seed-hash', true);

    const stagingUserId = Number.parseInt(process.env.STAGING_USER_ID || '0', 10);
    if (!stagingUserId) {
      throw new Error(
        'STAGING_USER_ID required - the PostgreSQL user ID. ' +
        'This is output when running k6:bootstrap:complex:staging.',
      );
    }

    // Seed to SQLite BEFORE signing in
    await seedStagingComplexKeysToSQLite(
      stagingKeys.privateKeys,
      localPassword,
      mnemonicHash,
      stagingUserId,
    );

    await organizationPage.signInOrganization(stagingEmail, stagingPassword, localPassword);

    console.log('Staging setup complete');

    return {
      complexKey: {
        adminKey: null as unknown as ComplexKeyResult['adminKey'], // Not needed for test assertions
        allPrivateKeys: stagingKeys.privateKeys,
        publicKeyToPrivateKey: new Map(
          stagingKeys.privateKeys.map((pk) => [pk.publicKey.toStringRaw(), pk]),
        ),
        metadata: {
          ...stagingKeys.metadata,
          childConfigs: [], // Not needed for assertions
        },
      },
      userKeyIds: [], // Not seeded by us on staging
      transactionIds: [], // Not seeded by us on staging
      userId: stagingUserId,
      mnemonicHash,
    };
  }

  // === LOCALNET PATH ===
  // Seed the regular org data first (creates PostgreSQL users)
  await seedOrgPerfData();

  await registrationPage.completeRegistration(
    `${testNamePrefix}-${Date.now()}@test.com`,
    localPassword,
  );

  const pooledUser = getPooledTestUser(testNamePrefix);

  await organizationPage.setupOrganization();
  await organizationPage.waitForElementToBeVisible(
    organizationPage.emailForOrganizationInputSelector,
  );

  // Seed complex keys to PostgreSQL BEFORE signing in
  const result = await seedComplexKeyData(pooledUser.email, useHederaStyle);

  // CRITICAL: Seed to SQLite BEFORE signing in
  // accountSetupRequired() is evaluated during sign-in, so keys must exist first
  await seedComplexKeysToSQLite(result.complexKey, localPassword, result.mnemonicHash, result.userId);

  // NOW sign in - accountSetupRequired() will find the keys and skip Account Setup
  await organizationPage.signInOrganization(pooledUser.email, pooledUser.password, localPassword);

  if (DEBUG) {
    console.log(`Complex key setup complete for ${pooledUser.email}`);
    console.log(`  Keys seeded: ${result.userKeyIds.length} (PostgreSQL + SQLite)`);
    console.log(`  Transactions: ${result.transactionIds.length}`);
  }

  return result;
}
