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

import {
  adminEmail,
  adminPassword,
  dummyEmail,
  dummyNewEmail,
  dummyNewPassword,
  dummyPassword,
} from './constants';

export async function createUser(
  dataSource: DataSource,
  email: string = 'admin@test.com',
  password: string = '1234567890',
  admin: boolean = false,
  status: UserStatus = UserStatus.NONE,
) {
  verifyEnv();

  const userRepo = dataSource.getRepository(User);

  /* Create partial admin user */
  const user = userRepo.create({
    email,
    admin,
    status: status,
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

export async function addUsers(dataSource?: DataSource) {
  const hasInitialDataSource = Boolean(dataSource);

  if (!dataSource) {
    dataSource = await connectDatabase();
  }

  const admin = await createUser(dataSource, adminEmail, adminPassword, true);
  const user = await createUser(dataSource, dummyEmail, dummyPassword, false);
  const userNew = await createUser(
    dataSource,
    dummyNewEmail,
    dummyNewPassword,
    false,
    UserStatus.NEW,
  );

  const { publicKeyRaw, mnemonicHash, index } = await generatePrivateKey();
  const {
    publicKeyRaw: publicKeyRaw1,
    mnemonicHash: mnemonicHash1,
    index: index1,
  } = await generatePrivateKey();

  if (!admin || !user || !userNew) {
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

  if (!hasInitialDataSource) {
    await dataSource.destroy();
  }

  console.log(chalk.green('Users added successfully \n'));
  console.log(`Id: ${admin.id}, Admin: ${admin.email}, ${adminPassword}, ${publicKeyRaw}`);
  console.log(`Id: ${user.id}, User: ${user.email}, ${dummyPassword}, ${publicKeyRaw1} \n`);
  console.log(`Id: ${userNew.id}, User: ${userNew.email}, ${dummyNewPassword} \n`);
}

export async function resetUsersState() {
  const dataSource = await connectDatabase();

  const userRepo = dataSource.getRepository(User);

  try {
    const admin = await userRepo.findOne({
      where: { email: adminEmail },
      withDeleted: true,
    });
    const user = await userRepo.findOne({ where: { email: dummyEmail }, withDeleted: true });
    const userNew = await userRepo.findOne({ where: { email: dummyNewEmail }, withDeleted: true });

    if (!admin || !user || !userNew) {
      console.log(chalk.red('Failed to reset users state'));
      return;
    }

    await userRepo.recover(admin);
    await userRepo.recover(user);
    await userRepo.recover(userNew);

    const hashAdmin = bcrypt.hashSync(adminPassword);
    const hashUser = bcrypt.hashSync(dummyPassword);
    const hashUserNew = bcrypt.hashSync(dummyNewPassword);

    admin.password = hashAdmin;
    user.password = hashUser;
    userNew.password = hashUserNew;

    admin.admin = true;
    user.admin = false;
    userNew.admin = false;

    await userRepo.save(admin);
    await userRepo.save(user);
    await userRepo.save(userNew);

    console.log(chalk.green('Users state reset successfully \n'));
  } catch (error) {
    console.log(chalk.red(error.message));
  }

  await dataSource.destroy();
}

export async function getUsers() {
  const dataSource = await connectDatabase();

  const userRepo = dataSource.getRepository(User);

  try {
    const users = await userRepo.find();
    await dataSource.destroy();
    return users;
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

export async function getUserKeys(id?: number) {
  const dataSource = await connectDatabase();

  const userKeyRepo = dataSource.getRepository(UserKey);

  try {
    const userKeys = await userKeyRepo.find(
      id
        ? {
            where: {
              user: {
                id,
              },
            },
          }
        : undefined,
    );

    await dataSource.destroy();
    return userKeys;
  } catch (error) {
    console.log(chalk.red(error.message));
  }
  await dataSource.destroy();
}

export async function getUser(type: 'admin' | 'user' | 'userNew') {
  const dataSource = await connectDatabase();

  const userRepo = dataSource.getRepository(User);

  try {
    const user = await userRepo.findOne({
      where: {
        email: type === 'admin' ? adminEmail : type === 'user' ? dummyEmail : dummyNewEmail,
      },
    });
    return user;
  } catch (error) {
    console.log(chalk.red(error.message));
  }

  await dataSource.destroy();
}

export async function clearUsers() {
  const dataSource = await connectDatabase();

  const userRepo = dataSource.getRepository(User);
  const userKeyRepo = dataSource.getRepository(UserKey);

  try {
    await userKeyRepo.delete({});
    await userRepo.delete({});
    console.log(chalk.green('Users cleared successfully \n'));
  } catch (error) {
    console.log(chalk.red(error.message));
  }

  await dataSource.destroy();
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

export async function resetDatabase() {
  const dataSource = await connectDatabase();

  try {
    await dataSource.synchronize(true);

    await addUsers(dataSource);

    console.log(chalk.green('Database reset successfully \n'));
  } catch (error) {
    console.log(chalk.red(error.message));
  }

  await dataSource.destroy();
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
