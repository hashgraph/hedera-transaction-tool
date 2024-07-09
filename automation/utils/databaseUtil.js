const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

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
  return new sqlite3.Database(getDatabasePath(), sqlite3.OPEN_READWRITE, err => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
  });
}

function closeDatabase(db) {
  db.close(err => {
    if (err) {
      console.error(err.message);
    }
    console.log('Closed the database connection.');
  });
}

function queryDatabase(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = openDatabase();
    console.log('Executing query:', query, 'Params:', params);
    db.get(query, params, (err, row) => {
      if (err) {
        console.error('Query error:', err.message);
        reject(err);
      } else {
        console.log('Query result:', row);
        resolve(row);
      }
    });
    closeDatabase(db);
  });
}

async function resetDbState() {
  const db = openDatabase();
  const tablesToReset = [
    'Organization',
    'User',
    'ComplexKey',
    'HederaAccount',
    'HederaFile',
    'KeyPair',
    'OrganizationCredentials',
    '"Transaction"',
    'TransactionDraft',
  ];

  try {
    for (const table of tablesToReset) {
      await new Promise((resolve, reject) => {
        db.run(`DELETE FROM ${table}`, [], function (err) {
          if (err) {
            console.error(`Error deleting records from ${table}:`, err.message);
            reject(err);
          } else {
            console.log(`Deleted all records from ${table}`);
            resolve();
          }
        });
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

async function createTestUser(email, password) {
  const client = await connectPostgresDatabase();

  try {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO "user" (email, password, status)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;
    const values = [email, hashedPassword, 'NONE'];

    const res = await client.query(query, values);
    console.log(`User created with ID: ${res.rows[0].id}`);
  } catch (err) {
    console.error('Error creating test user:', err);
  } finally {
    await disconnectPostgresDatabase(client);
  }
}

async function resetPostgresDbState() {
  const client = await connectPostgresDatabase();
  const tablesToReset = [
    'transaction_approver',
    'transaction_comment',
    'transaction_group_item',
    'transaction_group',
    'transaction_observer',
    'transaction_signer',
    'transaction',
    'user_key',
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
  createTestUser,
  resetDbState,
  resetPostgresDbState,
};
