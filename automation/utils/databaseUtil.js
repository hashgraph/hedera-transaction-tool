const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
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

async function resetPostgresDbState() {
  const client = await connectPostgresDatabase();
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
    'user',
  ];

  try {
    for (const table of tablesToReset) {
      const query = `DELETE FROM "${table}";`;
      await client.query(query);
      console.log(`Deleted all records from ${table}`);
    }
  } catch (err) {
    console.error('Error resetting PostgreSQL database:', err);
  } finally {
    await disconnectPostgresDatabase(client);
  }
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
