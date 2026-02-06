/**
 * Seed Test Users for k6 Performance Tests
 *
 * Creates test users directly in PostgreSQL using bcryptjs hashing.
 * Run this before k6 tests in CI or local development.
 *
 * Usage:
 *   cd automation && npx tsx k6/helpers/seed-test-users.ts
 *
 * Environment variables (user config):
 *   TEST_USER_EMAIL    - User email (default: k6perf@test.com)
 *   TEST_USER_PASSWORD - User password (default: Password123)
 *   TEST_USER_ADMIN    - Set to 'true' for admin (default: true)
 *   SEED_POOL          - Set to 'true' to seed all pool users
 *
 * Local database (default):
 *   POSTGRES_HOST      - Database host (default: localhost)
 *   POSTGRES_PORT      - Database port (default: 5432)
 *   POSTGRES_DATABASE  - Database name (default: postgres)
 *   POSTGRES_USERNAME  - Database user (default: postgres)
 *   POSTGRES_PASSWORD  - Database password (default: postgres)
 *
 * Staging database (via Teleport tunnel):
 *   STAGING_POSTGRES_HOST      - Tunnel host (e.g., localhost)
 *   STAGING_POSTGRES_PORT      - Tunnel port (assigned by tsh proxy)
 *   STAGING_POSTGRES_DATABASE  - Database name (default: development)
 *   STAGING_POSTGRES_USERNAME  - IAM user from Teleport
 *   STAGING_POSTGRES_PASSWORD  - Usually empty for IAM auth
 *
 * Example (staging via Teleport):
 *   tsh proxy db --tunnel gcp-tt-dev-postgres --db-user=<iam-user> --db-name=development
 *   STAGING_POSTGRES_HOST=localhost STAGING_POSTGRES_PORT=<tunnel_port> npx tsx k6/helpers/seed-test-users.ts
 */

import { Client, QueryResult } from 'pg';
import bcrypt from 'bcryptjs';
import { TEST_USER_POOL } from '../src/config/constants.js';

interface TestUser {
  email: string;
  password: string;
  isAdmin: boolean;
}

interface UserRow {
  id: number;
}

// Default test credentials (can be overridden via environment variables)
const DEFAULT_EMAIL = 'k6perf@test.com';
const DEFAULT_PASSWORD = 'Password123';

// Check if staging-specific environment variables are set
const IS_STAGING = Boolean(process.env.STAGING_POSTGRES_HOST);

interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

function getDbConfig(): DbConfig {
  if (IS_STAGING) {
    // Staging mode: use STAGING_POSTGRES_* vars (e.g., via Teleport tunnel)
    if (!process.env.STAGING_POSTGRES_HOST) {
      throw new Error('STAGING_POSTGRES_HOST is required for staging mode');
    }
    if (!process.env.STAGING_POSTGRES_USERNAME) {
      console.error('\nError: STAGING_POSTGRES_USERNAME is required for staging mode.');
      console.error('Set it to your Teleport IAM username (usually your email):\n');
      console.error('  export STAGING_POSTGRES_USERNAME="your.email@swirldslabs.com"');
      console.error('  pnpm run k6:tabs:dev\n');
      process.exit(1);
    }
    return {
      host: process.env.STAGING_POSTGRES_HOST,
      port: Number.parseInt(process.env.STAGING_POSTGRES_PORT || '5432', 10),
      database: process.env.STAGING_POSTGRES_DATABASE || 'development',
      user: process.env.STAGING_POSTGRES_USERNAME,
      password: process.env.STAGING_POSTGRES_PASSWORD || '',
    };
  }

  // Local mode: use standard POSTGRES_* vars
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number.parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DATABASE || 'postgres',
    user: process.env.POSTGRES_USERNAME || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  };
}

function getTestUser(): TestUser {
  const email = process.env.TEST_USER_EMAIL || DEFAULT_EMAIL;
  const password = process.env.TEST_USER_PASSWORD || DEFAULT_PASSWORD;

  return {
    email,
    password,
    isAdmin: process.env.TEST_USER_ADMIN !== 'false',
  };
}

const TEST_USER = getTestUser();

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Create or update a single user in the database.
 * Returns the user ID.
 */
async function seedSingleUser(
  client: Client,
  email: string,
  password: string,
  isAdmin: boolean,
): Promise<number> {
  // Check if user exists
  const existing: QueryResult<UserRow> = await client.query(
    'SELECT id FROM "user" WHERE email = $1',
    [email],
  );

  if (existing.rows.length > 0) {
    // User exists - update password to ensure it matches expected value
    const hashedPassword = await hashPassword(password);
    await client.query(
      `UPDATE "user" SET password = $1 WHERE email = $2`,
      [hashedPassword, email],
    );
    console.log(`User ${email} already exists (id: ${existing.rows[0].id}) - password updated`);
    return existing.rows[0].id;
  }

  // Hash password using bcryptjs (backend accepts both bcrypt and argon2)
  const hashedPassword = await hashPassword(password);

  // Insert user with status 'NEW' (same as backend createUser behavior)
  const result: QueryResult<UserRow> = await client.query(
    `INSERT INTO "user" (email, password, admin, status, "deletedAt")
     VALUES ($1, $2, $3, 'NEW', NULL)
     RETURNING id`,
    [email, hashedPassword, isAdmin],
  );

  console.log(`Created user: ${email} (id: ${result.rows[0].id})`);
  return result.rows[0].id;
}

async function seedUsers(): Promise<void> {
  const dbConfig = getDbConfig();
  const client = new Client(dbConfig);

  try {
    await client.connect();
    const modeLabel = IS_STAGING ? 'STAGING' : 'LOCAL';
    console.log(`Connected to PostgreSQL [${modeLabel}] - database: ${dbConfig.database}`);

    // SEED_POOL mode: create all pool users for rate limiting avoidance
    if (process.env.SEED_POOL === 'true') {
      console.log(`\nSeeding ${TEST_USER_POOL.length} pool users...`);
      for (const poolUser of TEST_USER_POOL) {
        await seedSingleUser(client, poolUser.email, poolUser.password, true);
      }
      console.log(`\nPool users seeded: ${TEST_USER_POOL.map(u => u.email).join(', ')}`);
      return;
    }

    // Single user mode (default)
    await seedSingleUser(client, TEST_USER.email, TEST_USER.password, TEST_USER.isAdmin);
    console.log('\nYou can run k6 tests with:');
    console.log(
      `  k6 run -e USER_EMAIL='${TEST_USER.email}' -e USER_PASSWORD='${TEST_USER.password}' k6/dist/tab-load-times.js`,
    );
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ECONNREFUSED') {
      console.error('Error: Cannot connect to PostgreSQL. Is Docker running?');
      console.log('\nStart the backend with: cd back-end && docker-compose up -d');
    } else {
      console.error('Error seeding users:', err.message);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

await seedUsers();
