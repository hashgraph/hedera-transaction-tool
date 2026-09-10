import type Database from 'better-sqlite3';
import { openSqliteDatabase } from './sqlite.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as url from 'url';
import { Client, QueryResultRow } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { shouldPreserveLocalAppState } from '../runtime/appMode.js';
import { applyPlaywrightIsolationEnv } from '../setup/playwrightIsolation.js';
import { shouldPreserveBackendState } from '../runtime/backendStateMode.js';

// Load environment variables from .env file
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

type DatabaseParams = Array<string | number>;

const DATABASE_DEBUG = process.env.CI !== 'true' && process.env.DATABASE_DEBUG === 'true';
const MAX_DEBUG_QUERY_LENGTH = 500;

function summarizeDatabaseParams(params: DatabaseParams): Array<number | string> {
  return params.map(param => {
    if (typeof param === 'number') {
      return param;
    }

    return `[redacted string length=${param.length}]`;
  });
}

function truncateQueryForDebugLog(query: string): string {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim();
  if (normalizedQuery.length <= MAX_DEBUG_QUERY_LENGTH) {
    return normalizedQuery;
  }

  return `${normalizedQuery.slice(0, MAX_DEBUG_QUERY_LENGTH)}... [truncated ${normalizedQuery.length - MAX_DEBUG_QUERY_LENGTH} chars]`;
}

function logDatabaseDebug(message: string, details?: Record<string, unknown>): void {
  if (!DATABASE_DEBUG) {
    return;
  }

  if (details) {
    console.log(message, details);
    return;
  }

  console.log(message);
}

// SQLite Functions
export function getDatabasePath(): string {
  const isolationContext = applyPlaywrightIsolationEnv();
  if (isolationContext) {
    return path.join(isolationContext.userDataDir, 'database.db');
  }

  const homeDir = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(
      homeDir,
      'Library',
      'Application Support',
      'hedera-transaction-tool',
      'database.db',
    );
  } else if (process.platform === 'linux') {
    return path.join(homeDir, '.config', 'hedera-transaction-tool', 'database.db');
  } else if (process.platform === 'win32') {
    return path.join(homeDir, 'AppData', 'Roaming', 'hedera-transaction-tool', 'database.db');
  } else {
    throw new Error('Unsupported platform');
  }
}

export function openDatabase(): Database.Database | null {
  const dbPath = getDatabasePath();
  if (!fs.existsSync(dbPath)) {
    console.log('SQLite database file does not exist.');
    return null;
  }

  const db = openSqliteDatabase(dbPath);
  logDatabaseDebug('Connected to the SQLite database.');
  return db;
}

export function closeDatabase(db: Database.Database): void {
  db.close();
  logDatabaseDebug('Disconnected from the SQLite database.');
}

export async function queryDatabase<T>(query: string, params: DatabaseParams = []): Promise<T> {
  const db = openDatabase();
  if (!db) throw new Error('SQLite database file does not exist.');
  try {
    logDatabaseDebug('Executing SQLite query', {
      query: truncateQueryForDebugLog(query),
      params: summarizeDatabaseParams(params),
    });
    // Preserve the existing API, which returns undefined at runtime for no row.
    const row = db.prepare<DatabaseParams, T>(query).get(...params);
    logDatabaseDebug('SQLite query completed', { hasRow: row !== undefined });
    return row as T;
  } finally {
    closeDatabase(db);
  }
}

export async function queryAllDatabase<T>(query: string, params: DatabaseParams = []): Promise<T[]> {
  const db = openDatabase();
  if (!db) throw new Error('SQLite database file does not exist.');
  try {
    logDatabaseDebug('Executing SQLite query (all)', {
      query: truncateQueryForDebugLog(query),
      params: summarizeDatabaseParams(params),
    });
    const rows = db.prepare<DatabaseParams, T>(query).all(...params);
    logDatabaseDebug('SQLite query completed', { rowCount: rows.length });
    return rows;
  } finally {
    closeDatabase(db);
  }
}

export async function executeDatabase(query: string, params: DatabaseParams = []): Promise<number> {
  const db = openDatabase();
  if (!db) throw new Error('SQLite database file does not exist.');
  try {
    logDatabaseDebug('Executing SQLite statement', {
      query: truncateQueryForDebugLog(query),
      params: summarizeDatabaseParams(params),
    });
    const { changes } = db.prepare(query).run(...params);
    logDatabaseDebug('SQLite statement completed', { changes });
    return changes;
  } finally {
    closeDatabase(db);
  }
}

export async function resetDbState() {
  if (shouldPreserveLocalAppState()) {
    console.log('Preserving local SQLite state. Skipping database reset.');
    return;
  }

  const db = openDatabase();
  if (!db) {
    console.log('SQLite database file does not exist. Skipping reset.');
    return;
  }

  const tablesToReset = [
    'Organization',
    'Claim',
    'User',
    'ComplexKey',
    'HederaAccount',
    'HederaFile',
    'KeyPair',
    'OrganizationCredentials',
    'Transaction',
    'TransactionDraft',
    'GroupItem',
    'TransactionGroup',
    'Mnemonic',
    'Contact',
    'PublicKeyMapping',
  ];

  try {
    for (const table of tablesToReset) {
      const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (row) {
        db.prepare(`DELETE FROM "${table}"`).run();
        console.log(`Deleted all records from ${table}`);
      } else {
        console.log(`Table ${table} does not exist, skipping.`);
      }
    }
  } catch (err) {
    console.error('Error resetting app state:', err);
  } finally {
    closeDatabase(db);
  }
}

export async function resetDbStateForTeardown() {
  if (process.env.CI) {
    console.log('Skipping SQLite teardown reset in CI.');
    return;
  }

  await resetDbState();
}

// PostgreSQL Functions
export async function connectPostgresDatabase(): Promise<Client> {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  });

  await client.connect();
  logDatabaseDebug('Connected to PostgreSQL database');

  return client;
}

export async function disconnectPostgresDatabase(client: Client) {
  await client.end();
  logDatabaseDebug('Disconnected from PostgreSQL database');
}

export async function queryPostgresDatabase<T extends QueryResultRow>(query: string, params: DatabaseParams = []) {
  const client = await connectPostgresDatabase();

  try {
    logDatabaseDebug('Executing PostgreSQL query', {
      query: truncateQueryForDebugLog(query),
      params: summarizeDatabaseParams(params),
    });
    const res = await client.query<T>(query, params);
    logDatabaseDebug('PostgreSQL query completed', { rowCount: res.rowCount });
    return res.rows;
  } catch (err: any) {
    console.error('Query error:', err.message);
    throw err;
  } finally {
    await disconnectPostgresDatabase(client);
  }
}

export async function createTestUsersBatch(usersData: {email: string, password: string}[], client: Client|null = null) {
  let localClient = client;
  let shouldDisconnect = false;

  if (!localClient) {
    localClient = await connectPostgresDatabase();
    shouldDisconnect = true;
  }

  try {
    const values = [];
    const placeholders = [];
    for (let i = 0; i < usersData.length; i++) {
      const { email, password } = usersData[i];
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(password, salt);
      values.push(email, hashedPassword, 'NONE');
      placeholders.push(`($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`);
    }
    const queryText = `INSERT INTO "user" (email, password, status) VALUES ${placeholders.join(', ')} RETURNING id;`;
    const res = await localClient.query(queryText, values);
    console.log('Created users with IDs:', res.rows.map(row => row.id));
  } catch (err) {
    console.error('Error creating test users:', err);
  } finally {
    if (shouldDisconnect) {
      await disconnectPostgresDatabase(localClient);
    }
  }
}

export async function resetPostgresDbState() {
  if (shouldPreserveBackendState()) {
    console.log('Preserving PostgreSQL state. Skipping database reset.');
    return;
  }

  const client = await connectPostgresDatabase();

  // Tables to reset - order matters for foreign key constraints
  const tablesToReset = [
    'notification_receiver',
    'transaction_approver',
    'transaction_comment',
    'transaction_group_item',
    'transaction_group',
    'transaction_observer',
    'transaction_signer',
    'transaction_entity',
    'transaction',
    'user_key',
    'notification_preferences',
    'client',
    'notification',
    'user',
  ];

  try {
    for (const table of tablesToReset) {
      await client.query(`DELETE FROM "${table}";`);
      console.log(`Deleted all records from ${table}`);
    }
  } catch (err) {
    console.error('Error resetting PostgreSQL database:', err);
  } finally {
    await disconnectPostgresDatabase(client);
  }
}

export async function resetPostgresDbStateForTeardown() {
  if (process.env.CI) {
    console.log('Skipping PostgreSQL teardown reset in CI.');
    return;
  }

  await resetPostgresDbState();
}

export async function flushRateLimiter() {
  if (shouldPreserveBackendState()) {
    console.log('Preserving backend state. Skipping Redis rate limiter flush.');
    return;
  }

  const { execSync } = await import('child_process');
  try {
    execSync('docker exec cache redis-cli FLUSHDB', { stdio: 'pipe' });
    console.log('Flushed Redis rate limiter');
  } catch (err) {
    console.error('Error flushing rate limiter:', err);
    throw err;
  }
}
