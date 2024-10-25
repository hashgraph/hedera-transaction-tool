import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

import {
  User,
  UserKey,
  Transaction,
  TransactionApprover,
  TransactionSigner,
  TransactionObserver,
  TransactionComment,
  TransactionGroupItem,
  TransactionGroup,
  Notification,
  NotificationPreferences,
  NotificationReceiver,
} from '@entities';

dotenv.config({
  path: path.join(__dirname, './.env'),
});

async function main() {
  /* Verify environment variables */
  verifyEnv();

  /* Bootstrap the database */
  const dataSource = await connectDatabase();

  /* Run migrations */
  await runMigrations(dataSource);

  /* Exit */
  console.log('Exiting...');
  process.exit(0);
}

main();

function verifyEnv() {
  const requiredEnv = [
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_DATABASE',
    'POSTGRES_USERNAME',
    'POSTGRES_PASSWORD',
  ];
  const missingEnv = requiredEnv.filter(env => !process.env[env]);

  if (missingEnv.length) {
    throw new Error(`Missing environment variables: ${missingEnv.join(', ')}`);
  }

  if (isNaN(Number(process.env.POSTGRES_PORT))) {
    throw new Error('POSTGRES_PORT must be a number');
  }
}

async function connectDatabase() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    username: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    synchronize: true, // Enable synchronize
    // synchronize: false, // Disable synchronize
    // migrations: [path.join(__dirname, '../migrations/*')],
    entities: [
      User,
      UserKey,
      Transaction,
      TransactionSigner,
      TransactionApprover,
      TransactionObserver,
      TransactionComment,
      TransactionGroupItem,
      TransactionGroup,
      Notification,
      NotificationPreferences,
      NotificationReceiver,
    ],
  });

  await dataSource.initialize();

  console.log('Connected to database');

  return dataSource;
}

async function runMigrations(dataSource: DataSource) {
  // console.log('Running migrations...');
  // await dataSource.runMigrations();
  // console.log('Migrations completed');
}