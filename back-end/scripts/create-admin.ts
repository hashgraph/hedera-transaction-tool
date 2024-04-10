/// <reference types="./environment.d.ts" />

import * as path from 'path';
import * as rl from 'readline-sync';

import * as dotenv from 'dotenv';
import * as chalk from 'chalk';
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
  UserStatus,
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
  const email: string = rl.questionEMail(`Enter ${chalk.blue('email')}: `);
  try {
    const emailExists = await userRepo.count({ where: { email } });
    if (emailExists) throw new Error('Email already exists');

    user.email = email;
  } catch (error) {
    console.log(chalk.red(error.message));
    console.log(chalk.redBright('\nExiting...'));
    process.exit(0);
  }
  console.log(`Email set: ${chalk.blue(email)}`);

  /* Getting user's password */
  const password = rl.questionNewPassword(`\nEnter ${chalk.red('password')}: `, {
    min: 8,
    max: 1000,
    limitMessage: 'Password must be at least 8 characters long',
  });
  const salt = await bcrypt.genSalt();
  const hash = await bcrypt.hash(password, salt);
  user.password = hash;
  console.log(`Password set: ${chalk.blue(hash)}\n`);

  /* Create user in database */
  try {
    const newUser = await userRepo.save(user);
    console.log(chalk.green('User created successfully\n'));
    console.log(`User ID: ${chalk.cyan(newUser.id)}`);
    console.log(`Email: ${chalk.cyan(newUser.email)}`);
    console.log(`Password hash: ${chalk.cyan(newUser.password)}`);
    console.log(`Admin: ${chalk.cyan(newUser.admin)}`);
  } catch (error) {
    console.log(chalk.red(error.message));
  }

  /* Exit */
  console.log(chalk.redBright('\nExiting...'));
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
    ],
  });

  await dataSource.initialize();

  console.log(chalk.cyan.underline('Connected to database \n'));

  return dataSource;
}
