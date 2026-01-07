/**
 * One-Time Complex Account Setup Script
 *
 * Creates a Hedera account with a complex threshold admin key.
 * This is a ONE-TIME setup script, not run per-test.
 *
 * Supports two modes:
 * - Localnet: Saves to data/complex-keys.json (gitignored)
 * - Staging: Outputs env vars to configure in CI/secrets manager
 *
 * Prerequisites:
 * - Hedera network running (localnet or staging)
 * - Operator account with sufficient HBAR
 *
 * Usage:
 *   npx tsx helpers/create-complex-accounts.ts --setup           # Localnet (default)
 *   npx tsx helpers/create-complex-accounts.ts --setup --staging # Staging mode
 *   npx tsx helpers/create-complex-accounts.ts --verify
 *   npx tsx helpers/create-complex-accounts.ts --simple          # Faster, fewer keys
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AccountCreateTransaction,
  AccountInfoQuery,
  Client,
  Hbar,
  PrivateKey,
} from '@hashgraph/sdk';
import { Client as PgClient } from 'pg';
import {
  generateHederaStyleComplexKey,
  generateSimpleComplexKey,
  serializeComplexKey,
  deserializeComplexKey,
  type ComplexKeyJson,
  type ComplexKeyResult,
} from './complex-keys.js';
import { seedComplexKeyTransactions } from './seed-perf-data.js';
import { argonHash } from '../../utils/crypto.js';
import { DATA_VOLUMES, COMPLEX_KEY } from '../src/config/constants.js';

/** Default output path for generated keys (localnet only) */
const DEFAULT_OUTPUT_PATH = path.join(__dirname, '..', 'data', 'complex-keys.json');
const DEBUG = process.env.DEBUG === 'true';

const isStaging = (): boolean => {
  return process.env.HEDERA_NETWORK === 'testnet' || process.argv.includes('--staging');
};

/** Localnet default configuration */
const LOCALNET_CONFIG = {
  // Default localnet operator (account 0.0.2 with well-known key)
  operatorId: process.env.OPERATOR_ID || '0.0.2',
  operatorKey:
    process.env.OPERATOR_KEY ||
    '302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137',
  network: 'local-node' as const,
  mirrorNodeUrl: process.env.MIRROR_NODE_URL || 'http://localhost:5551',
};

/** Staging configuration - requires env vars */
const STAGING_CONFIG = {
  operatorId: process.env.OPERATOR_ID,
  operatorKey: process.env.OPERATOR_KEY,
  network: 'testnet' as const,
};

function createLocalnetClient(): Client {
  const client = Client.forLocalNode();
  client.setOperator(
    LOCALNET_CONFIG.operatorId,
    PrivateKey.fromStringDer(LOCALNET_CONFIG.operatorKey),
  );
  return client;
}

function createStagingClient(): Client {
  if (!STAGING_CONFIG.operatorId || !STAGING_CONFIG.operatorKey) {
    throw new Error(
      'Staging mode requires OPERATOR_ID and OPERATOR_KEY environment variables.\n' +
      'Set these with your testnet operator credentials.',
    );
  }

  const client = Client.forTestnet();
  client.setOperator(
    STAGING_CONFIG.operatorId,
    PrivateKey.fromStringDer(STAGING_CONFIG.operatorKey),
  );
  return client;
}

function createClient(): Client {
  if (isStaging()) {
    console.log('Using STAGING (testnet) configuration');
    return createStagingClient();
  }
  console.log('Using LOCALNET configuration');
  return createLocalnetClient();
}

/**
 * Create an account with a complex threshold admin key
 *
 * @param client - Hedera client
 * @param useSimpleKey - If true, use simpler key structure (faster)
 * @param initialBalance - Initial HBAR balance
 * @returns Serialized key data and original key result (for transaction seeding)
 */
async function createAccountWithComplexKey(
  client: Client,
  useSimpleKey: boolean = false,
  initialBalance: Hbar = new Hbar(100),
): Promise<{ keyData: ComplexKeyJson; keyResult: ComplexKeyResult }> {
  console.log(`Generating ${useSimpleKey ? 'simple' : 'Hedera-style'} complex threshold key...`);

  const keyResult = useSimpleKey ? generateSimpleComplexKey() : generateHederaStyleComplexKey();

  console.log(`Generated ${keyResult.metadata.totalKeys} ED25519 keys`);
  console.log(
    `Structure: THRESHOLD (${keyResult.metadata.parentThreshold} of ${keyResult.metadata.childCount})`,
  );

  console.log('Creating account on Hedera...');

  const tx = new AccountCreateTransaction()
    .setInitialBalance(initialBalance)
    .setKeyWithoutAlias(keyResult.adminKey);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const accountId = receipt.accountId!.toString();

  console.log(`Account created: ${accountId}`);

  return {
    keyData: serializeComplexKey(keyResult, accountId),
    keyResult,
  };
}

async function verifyAccount(client: Client, accountId: string): Promise<boolean> {
  console.log(`Verifying account ${accountId}...`);

  try {
    const info = await new AccountInfoQuery().setAccountId(accountId).execute(client);

    console.log(`Account found: ${info.accountId}`);
    console.log(`Balance: ${info.balance}`);
    console.log(`Key type: ${info.key?.constructor.name}`);

    return true;
  } catch (error) {
    const err = error as Error;
    console.error(`Account verification failed: ${err.message}`);
    return false;
  }
}

function loadExistingKeys(outputPath: string): ComplexKeyJson | null {
  if (!fs.existsSync(outputPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(outputPath, 'utf-8');
    return JSON.parse(content) as ComplexKeyJson;
  } catch {
    return null;
  }
}

function saveKeys(data: ComplexKeyJson, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Keys saved to: ${outputPath}`);
}

/**
 * Output environment variables for staging mode
 * These should be added to CI/secrets manager, NOT committed to git
 */
function outputStagingEnvVars(data: ComplexKeyJson): void {
  console.log('\n=== STAGING ENVIRONMENT VARIABLES ===');
  console.log('Add these to your CI secrets or .env.staging (gitignored):\n');
  console.log(`COMPLEX_KEY_ACCOUNT_ID=${data.accountId}`);
  console.log(`COMPLEX_KEY_TOTAL=${data.metadata.totalKeys}`);
  console.log(`COMPLEX_KEY_THRESHOLD=${data.metadata.parentThreshold}`);
  console.log(`# Private keys (base64 encoded JSON array):`);
  console.log(`COMPLEX_KEY_PRIVATE_KEYS=${Buffer.from(JSON.stringify(data.privateKeys)).toString('base64')}`);
  console.log('\n=====================================');
  console.log('⚠️  Do NOT commit these values to git!');
  console.log('Store them in your CI secrets manager.');
}

/**
 * Seed complex keys to staging PostgreSQL user_key table.
 * IDEMPOTENT: Skips if keys already exist (unless --force).
 *
 * @param privateKeys - Array of PrivateKey objects to seed
 * @param userEmail - Email of the staging user to seed keys for
 * @param force - If true, delete existing keys and re-seed
 * @returns Object with userId and whether seeding occurred
 */
async function seedStagingUserKeys(
  privateKeys: PrivateKey[],
  userEmail: string,
  force: boolean = false,
): Promise<{ userId: number; seeded: boolean; firstUserKeyId: number }> {
  const pgHost = process.env.STAGING_POSTGRES_HOST;
  const pgPassword = process.env.STAGING_POSTGRES_PASSWORD;
  if (!pgHost || !pgPassword) {
    throw new Error('STAGING_POSTGRES_HOST and STAGING_POSTGRES_PASSWORD required for PostgreSQL seeding');
  }

  const client = new PgClient({
    host: pgHost,
    port: Number.parseInt(process.env.STAGING_POSTGRES_PORT || '5432', 10),
    database: process.env.STAGING_POSTGRES_DATABASE || 'postgres',
    user: process.env.STAGING_POSTGRES_USERNAME || 'postgres',
    password: pgPassword,
  });

  await client.connect();

  try {
    const existingUser = await client.query(
      'SELECT id FROM "user" WHERE email = $1',
      [userEmail],
    );

    if (existingUser.rows.length === 0) {
      throw new Error(`Staging user ${userEmail} not found. Create user first via staging admin.`);
    }

    const userId = existingUser.rows[0].id;
    if (DEBUG) console.log(`Found staging user ${userEmail} (ID: ${userId})`);

    // Check for existing active keys (excludes soft-deleted)
    const existingKeys = await client.query(
      'SELECT COUNT(*) as count FROM user_key WHERE "userId" = $1 AND "deletedAt" IS NULL',
      [userId],
    );
    const keyCount = Number.parseInt(existingKeys.rows[0].count, 10);

    if (keyCount > 0 && !force) {
      console.log(`User already has ${keyCount} keys. Skipping (use --force to re-seed).`);
      const firstKeyResult = await client.query(
        'SELECT id FROM user_key WHERE "userId" = $1 AND "deletedAt" IS NULL ORDER BY "index" LIMIT 1',
        [userId],
      );
      return { userId, seeded: false, firstUserKeyId: firstKeyResult.rows[0]?.id || 0 };
    }

    if (keyCount > 0 && force) {
      console.log(`Force mode: Deleting ${keyCount} existing keys...`);
      await client.query('DELETE FROM user_key WHERE "userId" = $1', [userId]);
    }

    // Use consistent hash (same as test will use)
    const mnemonicHash = await argonHash('complex-key-seed-hash', true);

    let firstUserKeyId = 0;
    for (let i = 0; i < privateKeys.length; i++) {
      const publicKey = privateKeys[i].publicKey.toStringRaw();
      const result = await client.query(
        `INSERT INTO user_key ("userId", "publicKey", "mnemonicHash", "index", "deletedAt")
         VALUES ($1, $2, $3, $4, NULL)
         RETURNING id`,
        [userId, publicKey, mnemonicHash, i],
      );
      if (i === 0) {
        firstUserKeyId = result.rows[0].id;
      }
    }

    console.log(`Seeded ${privateKeys.length} keys to staging PostgreSQL user_key`);
    return { userId, seeded: true, firstUserKeyId };
  } finally {
    await client.end();
  }
}

/**
 * Seed staging PostgreSQL with keys and transactions.
 */
async function seedStagingPostgres(
  keyData: ComplexKeyJson,
  keyResult: ComplexKeyResult,
  force: boolean,
): Promise<void> {
  if (!process.env.STAGING_POSTGRES_HOST) {
    console.log('\nSkipping PostgreSQL seeding (STAGING_POSTGRES_HOST not set)');
    return;
  }

  const userEmail = process.env.STAGING_USER_EMAIL;
  if (!userEmail) {
    console.log('\nSkipping PostgreSQL seeding (STAGING_USER_EMAIL not set)');
    return;
  }

  const privateKeys = keyData.privateKeys.map((k) => PrivateKey.fromStringED25519(k));
  const { userId, seeded, firstUserKeyId } = await seedStagingUserKeys(privateKeys, userEmail, force);
  console.log(`\nSTAGING_USER_ID=${userId}`);

  if (!seeded) {
    console.log('(Keys already existed, not re-seeded)');
  }

  if (!firstUserKeyId) {
    return;
  }

  const pgClient = new PgClient({
    host: process.env.STAGING_POSTGRES_HOST,
    port: Number.parseInt(process.env.STAGING_POSTGRES_PORT || '5432', 10),
    database: process.env.STAGING_POSTGRES_DATABASE || 'postgres',
    user: process.env.STAGING_POSTGRES_USERNAME || 'postgres',
    password: process.env.STAGING_POSTGRES_PASSWORD,
  });

  await pgClient.connect();
  try {
    const transactionIds = await seedComplexKeyTransactions(
      pgClient,
      keyResult,
      firstUserKeyId,
      DATA_VOLUMES.COMPLEX_KEY_GROUP_SIZE,
    );
    console.log(`\nSTAGING_TRANSACTION_COUNT=${transactionIds.length}`);
  } finally {
    await pgClient.end();
  }
}

async function setup(useSimpleKey: boolean = false): Promise<void> {
  const staging = isStaging();
  const outputPath = DEFAULT_OUTPUT_PATH;
  const force = process.argv.includes('--force');

  // For localnet, check for existing keys (idempotent)
  if (!staging) {
    const existing = loadExistingKeys(outputPath);
    if (existing && !force) {
      console.log(`Existing keys found for account ${existing.accountId}`);
      console.log(`Generated at: ${existing.generatedAt}`);
      console.log(`Use --force to recreate, or --verify to check account`);
      return;
    }
  }

  // For staging, check if account already configured via env var
  if (staging && process.env.COMPLEX_KEY_ACCOUNT_ID && !force) {
    console.log(`Existing staging account configured: ${process.env.COMPLEX_KEY_ACCOUNT_ID}`);
    console.log('Use --force to recreate (will require updating secrets)');
    return;
  }

  const client = createClient();

  try {
    const { keyData, keyResult } = await createAccountWithComplexKey(client, useSimpleKey);

    if (staging) {
      outputStagingEnvVars(keyData);
      await seedStagingPostgres(keyData, keyResult, force);
    } else {
      saveKeys(keyData, outputPath);
    }

    console.log('\nSetup complete!');
    console.log(`Account ID: ${keyData.accountId}`);
    console.log(`Total keys: ${keyData.metadata.totalKeys}`);
    console.log(`Minimum signatures needed: ${keyData.metadata.parentThreshold}`);
  } finally {
    client.close();
  }
}

async function verify(): Promise<void> {
  const staging = isStaging();
  const outputPath = DEFAULT_OUTPUT_PATH;

  let existing: ComplexKeyJson | null = null;
  if (staging && process.env.COMPLEX_KEY_ACCOUNT_ID && process.env.COMPLEX_KEY_PRIVATE_KEYS) {
    const privateKeys = JSON.parse(
      Buffer.from(process.env.COMPLEX_KEY_PRIVATE_KEYS, 'base64').toString(),
    ) as string[];
    existing = {
      accountId: process.env.COMPLEX_KEY_ACCOUNT_ID,
      metadata: {
        parentThreshold: process.env.COMPLEX_KEY_THRESHOLD
          ? Number.parseInt(process.env.COMPLEX_KEY_THRESHOLD, 10)
          : COMPLEX_KEY.PARENT_THRESHOLD,
        childCount: COMPLEX_KEY.CHILD_COUNT,
        totalKeys: process.env.COMPLEX_KEY_TOTAL
          ? Number.parseInt(process.env.COMPLEX_KEY_TOTAL, 10)
          : COMPLEX_KEY.TOTAL_KEYS,
        childConfigs: [],
      },
      privateKeys,
      publicKeys: [],
      adminKeyProtobuf: '',
      generatedAt: 'from-env',
    };
  } else if (!staging) {
    existing = loadExistingKeys(outputPath);
  }

  if (!existing) {
    console.log('No existing keys found. Run --setup first.');
    if (staging) {
      console.log('For staging, ensure COMPLEX_KEY_ACCOUNT_ID and COMPLEX_KEY_PRIVATE_KEYS are set.');
    }
    return;
  }

  const client = createClient();

  try {
    const valid = await verifyAccount(client, existing.accountId);

    if (valid) {
      console.log('\nVerification passed!');
      console.log(`Account ${existing.accountId} exists and is accessible`);

      // Also verify we can deserialize the keys
      const { privateKeys } = deserializeComplexKey(existing);
      console.log(`Loaded ${privateKeys.length} private keys from storage`);
    } else {
      console.log('\nVerification failed. Account may not exist on current network.');
      console.log('Consider running --setup --force to recreate.');
    }
  } finally {
    client.close();
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));

  if (args.has('--help') || args.has('-h')) {
    console.log(`
Complex Account Setup Script

Creates a Hedera account with a complex threshold admin key.
This is a ONE-TIME setup, not run per-test.

Usage:
  npx tsx helpers/create-complex-accounts.ts [options]

Options:
  --setup     Create a new complex key account (default action)
  --staging   Use staging (testnet) instead of localnet
  --simple    Use simpler key structure (faster, fewer keys)
  --force     Overwrite existing keys
  --verify    Verify existing account is accessible
  --help      Show this help

Environment Variables (required for --staging):
  OPERATOR_ID       Hedera operator account ID (default: 0.0.2 for localnet)
  OPERATOR_KEY      Hedera operator private key (DER format)
  HEDERA_NETWORK    Set to 'testnet' for staging mode

Environment Variables (optional for --staging PostgreSQL seeding):
  STAGING_USER_EMAIL        Email of staging user to seed keys for
  STAGING_POSTGRES_HOST     PostgreSQL host for staging
  STAGING_POSTGRES_PORT     PostgreSQL port (default: 5432)
  STAGING_POSTGRES_DATABASE PostgreSQL database (default: postgres)
  STAGING_POSTGRES_USERNAME PostgreSQL username (default: postgres)
  STAGING_POSTGRES_PASSWORD PostgreSQL password

Environment Variables (set after staging setup):
  COMPLEX_KEY_ACCOUNT_ID     Account ID with complex key
  COMPLEX_KEY_PRIVATE_KEYS   Base64-encoded JSON array of private keys
  COMPLEX_KEY_TOTAL          Total number of keys
  COMPLEX_KEY_THRESHOLD      Required signatures threshold
  STAGING_USER_ID            PostgreSQL user ID (output if PostgreSQL seeded)

Output:
  Localnet: Keys saved to automation/k6/data/complex-keys.json
  Staging:  Outputs env vars to configure in CI/secrets manager
            Optionally seeds PostgreSQL user_key table if DB creds provided
`);
    return;
  }

  if (args.has('--verify')) {
    await verify();
    return;
  }

  if (args.has('--force')) {
    const outputPath = DEFAULT_OUTPUT_PATH;
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
      console.log('Removed existing keys file');
    }
  }

  const useSimpleKey = args.has('--simple');
  await setup(useSimpleKey);
}

// Run if executed directly
const isMainModule = process.argv[1]?.includes('create-complex-accounts');
if (isMainModule) {
  await main().catch((error: unknown) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

