import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

import electron from 'electron';
import logger from 'electron-log';

import * as sqlite3 from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const dbPath = path.join(electron.app.getPath('userData'), 'User Storage', 'database.db');
const migrationsPath = path.join(electron.app.getAppPath(), './prisma/migrations');

if (!process.env.NODE_ENV) {
  console.log = logger.log;
}

export default async function initDatabase() {
  const db = new sqlite3.default(dbPath);

  let currentMigration = await getCurrentMigration();
  console.log(`Current migration: ${currentMigration?.name}`);

  const migrations = (await getAvailableMigrations()).sort(
    (m1, m2) => m1.created_at - m2.created_at,
  );

  const BEGIN = db.prepare('BEGIN');
  const COMMIT = db.prepare('COMMIT');
  const ROLLBACK = db.prepare('ROLLBACK');

  await BEGIN.run();
  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];

    if (currentMigration === null || migration.created_at > currentMigration.created_at) {
      try {
        console.log(`Applying migration: ${migration.name}`);

        // Execute Migration
        await db.exec(migration.sql);

        // Insert new migration version
        const insert = db.prepare(
          'INSERT INTO "Migration" (name, created_at) VALUES (@name, @created_at)',
        );
        await insert.run({ name: migration.name, created_at: migration.created_at });

        currentMigration = {
          name: migration.name,
          created_at: migration.created_at,
          id: -1,
        };
      } catch (error) {
        console.log(error);
        ROLLBACK.run();
      }
    }
  }

  if (db.inTransaction) {
    await COMMIT.run();
  }

  console.log('Database ready for usage');
}

export function getPrismaClient() {
  return new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
  });
}

async function getAvailableMigrations() {
  const migrationsData: { name: string; sql: string; created_at: number }[] = [];
  try {
    const folders = (await fsp.readdir(migrationsPath)).filter(file => {
      const fullPath = path.join(migrationsPath, file);

      return fs.statSync(fullPath).isDirectory();
    });

    for (const folder of folders) {
      const fullPath = path.join(migrationsPath, folder);

      if (fs.statSync(fullPath).isDirectory()) {
        const migrationObject = {
          name: folder,
          sql: '',
          created_at: getTimestamp(folder),
        };

        const sqlFiles = (await fsp.readdir(fullPath)).filter(file => file.endsWith('.sql'));

        for (const sqlFile of sqlFiles) {
          const sqlFilePath = path.join(fullPath, sqlFile);
          const sqlContent = await fsp.readFile(sqlFilePath, 'utf-8');
          migrationObject.sql = sqlContent;
        }

        migrationsData.push(migrationObject);
      }
    }
  } catch (error) {
    console.log(error);
  }

  return migrationsData;
}

async function getCurrentMigration() {
  const prisma = getPrismaClient();

  try {
    return await prisma.migration.findFirst({
      orderBy: [{ created_at: 'desc' }],
    });
  } catch (error) {
    console.log(error);

    return null;
  }
}

function getTimestamp(migrationName: string) {
  const [time] = migrationName.split('_');

  const year = parseInt(time.slice(0, 4), 10);
  const month = parseInt(time.slice(4, 6), 10) - 1;
  const day = parseInt(time.slice(6, 8), 10);
  const hours = parseInt(time.slice(8, 10), 10);
  const minutes = parseInt(time.slice(10, 12), 10);
  const seconds = parseInt(time.slice(12, 14), 10);

  const date = new Date(year, month, day, hours, minutes, seconds);
  return date.getTime() / 1000;
}
