/// <reference types="./environment.d.ts" />

import * as path from 'path';

import * as dotenv from 'dotenv';
import * as pc from 'picocolors';
import * as argon2 from 'argon2';

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
  UserStatus,
  Notification,
  NotificationPreferences,
  NotificationReceiver,
  TransactionCachedAccount,
  TransactionCachedNode,
  CachedAccount,
  CachedAccountKey,
  CachedNode,
  CachedNodeAdminKey,
  Client,
} from '@entities';

dotenv.config({
  path: path.join(__dirname, './.env'),
});

async function main() {
  /* Verify environment variables */
  verifyEnv();

  /* Setup database connection */
  const dataSource = await connectDatabase();
  const userRepo = dataSource.getRepository(User);

  const data = [
    {
      email: 'test10@test.com',
      password: '159357',
      admin: true,
      status: UserStatus.NONE,
    },
    {
      email: 'test11@test.com',
      password: '159357',
      admin: true,
      status: UserStatus.NONE,
    },
  ];

  for (let i = 0; i < data.length; i++) {
    /* Create user */
    let user = userRepo.create(data[i]);

    const hashed = await hash(user.password);
    user.password = hashed;
    console.log(`Password set: ${pc.blue(hashed)}\n`);

    /* Create user in database */
    try {
      user = await userRepo.save(user);
    } catch (error) {
      console.log(pc.red(error.message));
    }
  }

  /* Exit */
  console.log(pc.redBright('\nExiting...'));
  try {
    await dataSource.destroy();
    console.log(pc.cyan('Disconnected from database'));
    process.exit(0);
  } catch (err) {
    console.error(pc.red('Error while disconnecting from database:'), err);
    process.exit(1);
  }
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
    synchronize: false,
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
      TransactionCachedAccount,
      TransactionCachedNode,
      CachedAccount,
      CachedAccountKey,
      CachedNode,
      CachedNodeAdminKey,
      Notification,
      NotificationPreferences,
      NotificationReceiver,
      Client,
    ],
  });

  await dataSource.initialize();

  console.log(pc.underline(pc.cyan('Connected to database \n')));

  return dataSource;
}

async function hash(data: string, usePseudoSalt = false): Promise<string> {
  let pseudoSalt: Buffer | undefined;
  if (usePseudoSalt) {
    const paddedData = data.padEnd(16, 'x');
    pseudoSalt = Buffer.from(paddedData.slice(0, 16));
  }
  return await argon2.hash(data, {
    salt: pseudoSalt,
  });
}
