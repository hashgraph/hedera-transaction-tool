/// <reference types="./environment.d.ts" />
import 'tsconfig-paths/register';

import * as path from 'path';
import * as rl from 'readline-sync';

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
  TransactionAccountSnapshot,
  TransactionNodeSnapshot,
  AccountSnapshot,
  NodeSnapshot,
} from '@entities';

dotenv.config({
  path: path.join(__dirname, './.env'),
});

async function main() {
  /* Verify environment variables */
  verifyEnv();

  const data = [
    {
      email: 'victor@test.com',
      password: 'qwerty====',
      admin: true,
      status: UserStatus.NONE,
    },
    {
      email: 'alice@test.com',
      password: 'qwerty====',
      admin: false,
      status: UserStatus.NONE,
    },
    {
      email: 'bob@test.com',
      password: 'qwerty====',
      admin: false,
      status: UserStatus.NEW,
    },
  ];

  console.log('The following users will be inserted in ' + postgresLabel() + ':');
  console.log();
  for (const d of data) {
    console.log(
      '    ' + d.email + ', password=' + d.password + ', admin=' + d.admin + ', status=' + d.status,
    );
  }
  console.log();
  if (!rl.keyInYN('Continue?')) {
    return;
  }

  /* Setup database connection */
  const dataSource = await connectDatabase();
  const userRepo = dataSource.getRepository(User);

  for (const userData of data) {
    const newUser = userRepo.create({
      email: userData.email,
      password: await hash(userData.password),
      admin: userData.admin,
      status: UserStatus.NONE,
    });

    /* Create user in database */
    try {
      await userRepo.save(newUser);
      console.log(pc.green('User created successfully\n'));
      console.log(`User ID: ${pc.cyan(newUser.id)}`);
      console.log(`Email: ${pc.cyan(newUser.email)}`);
      console.log(`Password hash: ${pc.cyan(newUser.password)}`);
      console.log(`Admin: ${pc.cyan(newUser.admin.toString())}`);
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

function postgresLabel(): string {
  return (
    process.env.POSTGRES_HOST +
    ':' +
    process.env.POSTGRES_PORT +
    '/' +
    process.env.POSTGRES_DATABASE
  );
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
      AccountSnapshot,
      NodeSnapshot,
      TransactionAccountSnapshot,
      TransactionNodeSnapshot,
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
