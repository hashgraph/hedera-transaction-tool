const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

// Function to get the database path
function getDatabasePath() {
  const homeDir = os.homedir();
  return path.join(
    homeDir,
    'Library',
    'Application Support',
    'hedera-transaction-tool',
    'database.db',
  );
}

// Function to open the database connection
function openDatabase() {
  return new sqlite3.Database(getDatabasePath(), sqlite3.OPEN_READONLY, err => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
  });
}

// Function to close the database connection
function closeDatabase(db) {
  db.close(err => {
    if (err) {
      console.error(err.message);
    }
    console.log('Closed the database connection.');
  });
}

// Function to query the database
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

module.exports = {
  queryDatabase,
};
