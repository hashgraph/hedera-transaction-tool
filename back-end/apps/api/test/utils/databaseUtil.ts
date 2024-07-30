import * as chalk from 'chalk';
import * as bcrypt from 'bcryptjs';

import { DataSource, DeepPartial } from 'typeorm';

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
} from '../../../../libs/common/src/database/entities';

import { generatePrivateKey } from './hederaUtils';

import { adminEmail, adminPassword, dummyEmail, dummyPassword } from './constants';

export async function createUser(
  dataSource: DataSource,
  email: string = 'admin@test.com',
  password: string = '1234567890',
  admin: boolean = false,
) {
  verifyEnv();

  const userRepo = dataSource.getRepository(User);

  /* Create partial admin user */
  const user = userRepo.create({
    email,
    admin,
    status: UserStatus.NONE,
    password,
  });

  const hash = bcrypt.hashSync(user.password);
  user.password = hash;

  try {
    return await userRepo.save(user);
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

export async function attachKeyToUser(
  dataSource: DataSource,
  userId: number,
  key: DeepPartial<UserKey>,
) {
  verifyEnv();

  /* Setup database connection */
  const userKeyRepo = dataSource.getRepository(UserKey);

  /* Create key */
  const userKey = userKeyRepo.create({
    ...key,
    user: {
      id: userId,
    },
  });

  try {
    return await userKeyRepo.save(userKey);
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

export async function addUsers() {
  const dataSource = await connectDatabase();

  const admin = await createUser(dataSource, adminEmail, adminPassword, true);
  const user = await createUser(dataSource, dummyEmail, dummyPassword, false);

  const { publicKeyRaw, mnemonicHash, index } = await generatePrivateKey();
  const {
    publicKeyRaw: publicKeyRaw1,
    mnemonicHash: mnemonicHash1,
    index: index1,
  } = await generatePrivateKey();

  if (!admin || !user) {
    console.log(chalk.red('Failed to add users'));
    return;
  }

  await attachKeyToUser(dataSource, admin.id, {
    publicKey: publicKeyRaw,
    mnemonicHash,
    index,
  });

  await attachKeyToUser(dataSource, user.id, {
    publicKey: publicKeyRaw1,
    mnemonicHash: mnemonicHash1,
    index: index1,
  });

  dataSource.destroy();

  console.log(chalk.green('Users added successfully \n'));
  console.log(`Id: ${admin.id}, Admin: ${admin.email}, ${adminPassword}, ${publicKeyRaw}`);
  console.log(`Id: ${user.id}, User: ${user.email}, ${dummyPassword}, ${publicKeyRaw1} \n`);
}

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
    synchronize: true,
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
    ],
  });

  await dataSource.initialize();

  console.log(chalk.cyan.underline('Connected to database \n'));

  return dataSource;
}
