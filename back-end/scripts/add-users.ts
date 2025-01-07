/// <reference types="./environment.d.ts" />

import * as path from 'path';

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

    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(user.password, salt);
    user.password = hash;
    console.log(`Password set: ${pc.blue(hash)}\n`);

    /* Create user in database */
    try {
      user = await userRepo.save(user);
    } catch (error) {
      console.log(pc.red(error.message));
    }
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

  console.log(pc.underline(pc.cyan('Connected to database \n')));

  return dataSource;
}
