import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { openSqliteDatabase } from './sqlite.js';
import { insertKeyPair } from './localQueries.js';
import { queryAllDatabase } from './databaseUtil.js';
import { clearPlaywrightIsolationEnv } from '../setup/playwrightIsolation.js';

test('key-pair seeding persists both lookup and explicit IDs and propagates failures', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'automation-key-seeding-'));
  const originalEnv = { ...process.env };
  clearPlaywrightIsolationEnv();
  process.env.PLAYWRIGHT_USER_DATA_DIR = directory;
  try {
    const db = new Database(path.join(directory, 'database.db'));
    try {
      db.exec(`
        CREATE TABLE User (id TEXT PRIMARY KEY, email TEXT);
        CREATE TABLE Organization (id TEXT PRIMARY KEY);
        CREATE TABLE KeyPair (
          id TEXT PRIMARY KEY, user_id TEXT, "index" INTEGER, public_key TEXT,
          private_key TEXT, type TEXT, organization_id TEXT, secret_hash TEXT,
          organization_user_id TEXT
        );
        INSERT INTO User VALUES ('local-user', 'test@example.com');
        INSERT INTO Organization VALUES ('local-org');
      `);
    } finally {
      db.close();
    }
    await insertKeyPair('public-1', 'encrypted-1', 'hash-1', 'remote-1');
    await insertKeyPair('public-2', 'encrypted-2', 'hash-2', 'remote-2', 'explicit-user', 'explicit-org');
    assert.deepEqual(await queryAllDatabase(
      'SELECT user_id, organization_id, organization_user_id FROM KeyPair ORDER BY public_key',
    ), [
      { user_id: 'local-user', organization_id: 'local-org', organization_user_id: 'remote-1' },
      { user_id: 'explicit-user', organization_id: 'explicit-org', organization_user_id: 'remote-2' },
    ]);
    const cleanup = openSqliteDatabase(path.join(directory, 'database.db'));
    try {
      cleanup.exec('DROP TABLE KeyPair');
    } finally {
      cleanup.close();
    }
    await assert.rejects(insertKeyPair('public-3', 'encrypted-3', 'hash-3', 'remote-3'), /no such table/);
  } finally {
    clearPlaywrightIsolationEnv();
    Object.assign(process.env, originalEnv);
    rmSync(directory, { recursive: true, force: true });
  }
});

test('automation Node binding supports fixture queries and persists changes', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'automation-sqlite-'));
  const filename = path.join(directory, 'database.db');
  try {
    const setup = new Database(filename);
    setup.exec('CREATE TABLE parent (id INTEGER PRIMARY KEY); CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id), name TEXT)');
    setup.close();

    const db = openSqliteDatabase(filename);
    try {
      // Fixture helpers historically allow orphan references during seed/reset.
      assert.equal(db.pragma('foreign_keys', { simple: true }), 0);
      assert.equal(db.prepare('INSERT INTO child VALUES (?, ?, ?)').run(1, 99, "O'Brien").changes, 1);
      assert.deepEqual(db.prepare('SELECT name FROM child WHERE id = ?').get(1), { name: "O'Brien" });
      assert.equal(db.prepare('SELECT * FROM child WHERE id = ?').get(2), undefined);
      assert.deepEqual(db.prepare('SELECT * FROM child WHERE id = ?').all(2), []);
      assert.throws(() => db.prepare('SELECT * FROM missing_table').get());
    } finally {
      db.close();
    }

    const reader = openSqliteDatabase(filename, true);
    try {
      assert.equal(reader.prepare('SELECT COUNT(*) AS count FROM child').pluck().get(), 1);
      assert.throws(() => reader.prepare('DELETE FROM child').run(), /readonly/);
    } finally {
      reader.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('opening a missing fixture database fails without creating it', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'automation-sqlite-'));
  const filename = path.join(directory, 'missing.db');
  try {
    assert.throws(() => openSqliteDatabase(filename));
    assert.equal(existsSync(filename), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
