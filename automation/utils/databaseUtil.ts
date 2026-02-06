import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as url from 'url';
import { Client, QueryResultRow } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// SQLite Functions
export function getDatabasePath(): string {
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

export function openDatabase(): sqlite3.Database | null {
  const dbPath = getDatabasePath();
  if (!fs.existsSync(dbPath)) {
    console.log('SQLite database file does not exist.');
    return null;
  }

  return new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, err => {
    if (err) {
      console.error('Failed to connect to the SQLite database:', err.message);
    } else {
      console.log('Connected to the SQLite database.');
    }
  });
}

export function closeDatabase(db: sqlite3.Database): void {
  if (db) {
    db.close(err => {
      if (err) {
        console.error('Failed to close the SQLite database:', err.message);
      } else {
        console.log('Disconnected from the SQLite database.');
      }
    });
  }
}

export function queryDatabase<T>(query: string, params: (string|number)[] = []): Promise<T> {
  return new Promise((resolve, reject) => {
    const db = openDatabase();
    if (!db) {
      reject(new Error('SQLite database file does not exist.'));
      return;
    }

    console.log('Executing query:', query, 'Params:', params);
    db.get<T>(query, params, (err, row) => {
      if (err) {
        console.error('Query error:', err.message);
        reject(err);
      } else {
        console.log('Query result:', row);
        resolve(row);
      }
      closeDatabase(db);
    });
  });
}

export async function resetDbState() {
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
    // Additional tables that were missing - Mnemonic is critical for full reset
    'Mnemonic',
    'Contact',
    'PublicKeyMapping',
  ];

  try {
    for (const table of tablesToReset) {
      await new Promise<void>((resolve, reject) => {
        // Check if the table exists
        db.get(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
          [table],
          (err, row) => {
            if (err) {
              console.error(`Error checking for table ${table}:`, err.message);
              reject(err);
            } else if (row) {
              // Table exists, proceed to delete
              db.run(`DELETE FROM "${table}"`, [], function (err) {
                if (err) {
                  console.error(`Error deleting records from ${table}:`, err.message);
                  reject(err);
                } else {
                  console.log(`Deleted all records from ${table}`);
                  resolve();
                }
              });
            } else {
              // Table does not exist, skip
              console.log(`Table ${table} does not exist, skipping.`);
              resolve();
            }
          },
        );
      });
    }
  } catch (err) {
    console.error('Error resetting app state:', err);
  } finally {
    closeDatabase(db);
  }
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
  console.log('Connected to PostgreSQL database');

  return client;
}

export async function disconnectPostgresDatabase(client: Client) {
  await client.end();
  console.log('Disconnected from PostgreSQL database');
}

export async function queryPostgresDatabase<T extends QueryResultRow>(query: string, params: (string|number)[] = []) {
  const client = await connectPostgresDatabase();

  try {
    console.log('Executing query:', query, 'Params:', params);
    const res = await client.query<T>(query, params);
    console.log('Query result:', res.rows);
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

export async function flushRateLimiter() {
  const { execSync } = await import('child_process');
  try {
    execSync('docker exec cache redis-cli FLUSHDB', { stdio: 'pipe' });
    console.log('Flushed Redis rate limiter');
  } catch (err) {
    console.error('Error flushing rate limiter:', err);
  }
}
