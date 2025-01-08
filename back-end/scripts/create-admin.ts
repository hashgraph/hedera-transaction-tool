/// <reference types="./environment.d.ts" />

import * as path from 'path';
import * as rl from 'readline-sync';

import * as dotenv from 'dotenv';
import * as pc from 'picocolors';
import * as bcrypt from 'bcryptjs';

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
} from '../libs/common/src/database/entities';

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
    min: 8,
    max: 1000,
    limitMessage: 'Password must be at least 8 characters long',
  });
  const salt = await bcrypt.genSalt();
  const hash = await bcrypt.hash(password, salt);
  user.password = hash;
  console.log(`Password set: ${pc.blue(hash)}\n`);

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
      Notification,
      NotificationPreferences,
      NotificationReceiver,
    ],
  });

  await dataSource.initialize();

  console.log(pc.cyan(pc.underline('Connected to database \n')));

  return dataSource;
}
