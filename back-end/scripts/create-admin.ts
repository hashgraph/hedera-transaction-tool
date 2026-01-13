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
  Client,
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

  /* Create partial admin user */
  const user = userRepo.create({
    admin: true,
    status: UserStatus.NONE,
  });

  /* Getting user's email */
  const email: string = rl.questionEMail(`Enter ${pc.blue('email')}: `);
  try {
    const emailExists = await userRepo.count({ where: { email } });
    if (emailExists) throw new Error('Email already exists');

    user.email = email;
  } catch (error) {
    console.log(pc.red(error.message));
    console.log(pc.redBright('\nExiting...'));
    process.exit(0);
  }
  console.log(`Email set: ${pc.blue(email)}`);

  /* Getting user's password */
  const password = rl.questionNewPassword(`\nEnter ${pc.red('password')}: `, {
    min: 10,
    max: 1000,
    limitMessage: 'Password must be at least 10 characters long',
  });
  const hashed = await hash(password);
  user.password = hashed;
  console.log(`Password set: ${pc.blue(hashed)}\n`);

  /* Create user in database */
  try {
    const newUser = await userRepo.save(user);
    console.log(pc.green('User created successfully\n'));
    console.log(`User ID: ${pc.cyan(newUser.id)}`);
    console.log(`Email: ${pc.cyan(newUser.email)}`);
    console.log(`Password hash: ${pc.cyan(newUser.password)}`);
    console.log(`Admin: ${pc.cyan(newUser.admin.toString())}`);
  } catch (error) {
    console.log(pc.red(error.message));
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
      Client,
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
    ],
  });

  await dataSource.initialize();

  console.log(pc.cyan(pc.underline('Connected to database \n')));

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
