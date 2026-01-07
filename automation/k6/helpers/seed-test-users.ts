/**
 * Seed Test Users for k6 Performance Tests
 *
 * Creates test users directly in PostgreSQL using argon2 hashing.
 * Run this before k6 tests in CI or local development.
 *
 * Usage:
 *   cd automation && npx tsx k6/helpers/seed-test-users.ts
 *
 * Environment variables:
 *   TEST_USER_EMAIL    - User email (required)
 *   TEST_USER_PASSWORD - User password (required)
 *   TEST_USER_ADMIN    - Set to 'true' for admin (default: true)
 */

import { Client, QueryResult } from 'pg';
import * as argon2 from 'argon2';
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
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
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

  // Hash password using argon2 (same as backend)
  const hashedPassword = await hashPassword(password);

  // Insert user
  const result: QueryResult<UserRow> = await client.query(
    `INSERT INTO "user" (email, password, admin, status, "deletedAt")
     VALUES ($1, $2, $3, 'NONE', NULL)
     RETURNING id`,
    [email, hashedPassword, isAdmin],
  );

  console.log(`Created user: ${email} (id: ${result.rows[0].id})`);
  return result.rows[0].id;
}

async function seedUsers(): Promise<void> {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number.parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DATABASE || 'postgres',
    user: process.env.POSTGRES_USERNAME || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

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
