import Database from 'better-sqlite3';

export function openSqliteDatabase(filename: string, readonly = false): Database.Database {
  const db = new Database(filename, {
    readonly,
    fileMustExist: true,
  });
  // Match the old sqlite3 connection defaults used by fixture seed/reset code.
  db.pragma('foreign_keys = OFF');
  return db;
}
