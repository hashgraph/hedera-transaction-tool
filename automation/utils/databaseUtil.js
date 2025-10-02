const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

// SQLite Functions
function getDatabasePath() {
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

function openDatabase() {
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

function closeDatabase(db) {
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

function queryDatabase(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = openDatabase();
    if (!db) {
      reject(new Error('SQLite database file does not exist.'));
      return;
    }

    console.log('Executing query:', query, 'Params:', params);
    db.get(query, params, (err, row) => {
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

async function resetDbState() {
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
  ];

  try {
    for (const table of tablesToReset) {
      await new Promise((resolve, reject) => {
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
async function connectPostgresDatabase() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  });

  await client.connect();
  console.log('Connected to PostgreSQL database');

  return client;
}

async function disconnectPostgresDatabase(client) {
  await client.end();
  console.log('Disconnected from PostgreSQL database');
}

async function queryPostgresDatabase(query, params = []) {
  const client = await connectPostgresDatabase();

  try {
    console.log('Executing query:', query, 'Params:', params);
    const res = await client.query(query, params);
    console.log('Query result:', res.rows);
    return res.rows;
  } catch (err) {
    console.error('Query error:', err.message);
    throw err;
  } finally {
    await disconnectPostgresDatabase(client);
  }
}

async function createTestUsersBatch(usersData, client = null) {
  let localClient = client;
  let shouldDisconnect = false;

  if (!localClient) {
    localClient = await connectPostgresDatabase();
    shouldDisconnect = true;
  }

  try {
    const queries = [];
    for (const { email, password } of usersData) {
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(password, salt);
      const query = {
        text: `INSERT INTO "user" (email, password, status) VALUES ($1, $2, $3) RETURNING id;`,
        values: [email, hashedPassword, 'NONE'],
      };
      queries.push(localClient.query(query.text, query.values));
    }

    const results = await Promise.all(queries);
    results.forEach((res, index) => {
      console.log(`User ${index + 1} created with ID: ${res.rows[0].id}`);
    });
  } catch (err) {
    console.error('Error creating test users:', err);
  } finally {
    if (shouldDisconnect) {
      await disconnectPostgresDatabase(localClient);
    }
  }
}

//TODO this may be overkill for beforeEach and may be better suited for beforeAll/afterAll
// this wont actually work, because the backend is using the postgres, so I need to actually deploy a backend specifically for this testing
// so maybe I can create a script in automation that will deploy a backend and specificy the datbase name to be used, then it can
// sycnrhonize and everything? it'll only work if it stops any current backend running first'
async function resetPostgresDbState() {
  // Step 1: Connect to the default 'postgres' database
  const adminClient = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: 'postgres',
  });
  await adminClient.connect();

  // Step 2: Drop and create the 'automation' database
  await adminClient.query('DROP DATABASE IF EXISTS automation;');
  await adminClient.query('CREATE DATABASE automation;');
  await adminClient.end();

  //TODO This REQUIRES that postgres is installed locally (via brew or similar) and that the version installed is >= the version
  //used in the backend
  try {
    // 3. Dump schema from source database (e.g., 'postgres')
    const dumpFile = '/tmp/schema.sql';
    execSync(
      `PGPASSWORD=${process.env.POSTGRES_PASSWORD} pg_dump -h ${process.env.POSTGRES_HOST} -U ${process.env.POSTGRES_USERNAME} -d postgres --schema-only > ${dumpFile}`
    );

    // 4. Load the schema into 'automation' database
    execSync(
      `PGPASSWORD=${process.env.POSTGRES_PASSWORD} psql -h ${process.env.POSTGRES_HOST} -U ${process.env.POSTGRES_USERNAME} -d automation -f ${dumpFile}`
    );
    fs.unlinkSync(dumpFile);
  } catch (error) {
    console.error('Error synchronizing schema:', error);
    throw error;
  }
  console.log('Automation database recreated and schema synchronized.');
}

module.exports = {
  queryDatabase,
  createTestUsersBatch,
  resetDbState,
  resetPostgresDbState,
  queryPostgresDatabase,
  connectPostgresDatabase,
  disconnectPostgresDatabase,
};
