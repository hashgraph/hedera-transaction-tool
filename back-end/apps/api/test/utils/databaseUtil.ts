import * as chalk from 'chalk';
import * as bcrypt from 'bcryptjs';

import { DataSource, DeepPartial } from 'typeorm';
import {
  AccountCreateTransaction,
  AccountUpdateTransaction,
  FileCreateTransaction,
  KeyList,
} from '@hashgraph/sdk';

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

import {
  createTransactionId,
  generatePrivateKey,
  localnet1002,
  localnet1003,
  localnet1004,
  localnet1022,
  localnet2,
} from './hederaUtils';

import {
  adminEmail,
  adminPassword,
  dummyEmail,
  dummyNewEmail,
  dummyNewPassword,
  dummyPassword,
} from './constants';

export async function createUser(
  email: string = 'admin@test.com',
  password: string = '1234567890',
  dataSource?: DataSource,
  admin: boolean = false,
  status: UserStatus = UserStatus.NONE,
) {
  verifyEnv();

  const hasInitialDataSource = Boolean(dataSource);

  if (!dataSource) {
    dataSource = await connectDatabase();
  }

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

  if (!hasInitialDataSource) {
    await dataSource.destroy();
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

  const admin = await createUser(adminEmail, adminPassword, dataSource, true);
  const user = await createUser(dummyEmail, dummyPassword, dataSource, false);
  const userNew = await createUser(
    dummyNewEmail,
    dummyNewPassword,
    dataSource,
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

export async function addHederaLocalnetAccounts(dataSource?: DataSource) {
  const hasInitialDataSource = Boolean(dataSource);

  if (!dataSource) {
    dataSource = await connectDatabase();
  }

  const admin = await getUser('admin');
  const user = await getUser('user');

  if (!admin || !user) {
    console.log(chalk.red('Failed to add users'));
    return;
  }

  for (const account of [localnet2, localnet1002, localnet1022]) {
    await attachKeyToUser(dataSource, admin.id, {
      publicKey: account.publicKeyRaw,
    });
  }

  for (const account of [localnet1003, localnet1004]) {
    await attachKeyToUser(dataSource, user.id, {
      publicKey: account.publicKeyRaw,
    });
  }

  if (!hasInitialDataSource) {
    await dataSource.destroy();
  }
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

export async function getUserKey(userId: number, publicKey: string) {
  const dataSource = await connectDatabase();

  const userKeyRepo = dataSource.getRepository(UserKey);

  try {
    const userKey = await userKeyRepo.findOne({
      where: {
        user: {
          id: userId,
        },
        publicKey,
      },
    });

    await dataSource.destroy();
    return userKey;
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

export async function addTransactions(dataSource: DataSource) {
  const transactionRepo = dataSource.getRepository(Transaction);

  const admin = await getUser('admin');
  const user = await getUser('user');

  if (!admin || !user) {
    console.log(chalk.red('Failed to add transactions'));
    return;
  }

  const userKey1003 = await getUserKey(user.id, localnet1003.publicKeyRaw);
  const userKey1004 = await getUserKey(user.id, localnet1004.publicKeyRaw);
  const adminKey2 = await getUserKey(admin.id, localnet2.publicKeyRaw);
  const adminKey1002 = await getUserKey(admin.id, localnet1002.publicKeyRaw);

  if (!userKey1003 || !userKey1004 || !adminKey2 || !adminKey1002) {
    throw new Error('Keys not found');
  }

  const accountCreate = new AccountCreateTransaction()
    .setTransactionId(createTransactionId(localnet1003.accountId))
    .setKey(localnet1003.publicKey);

  const accountUpdate = new AccountUpdateTransaction()
    .setTransactionId(createTransactionId(localnet1004.accountId))
    .setAccountId(localnet1004.accountId)
    .setKey(localnet1004.publicKey);

  const fileCreate = new FileCreateTransaction()
    .setTransactionId(createTransactionId(localnet1002.accountId))
    .setKeys(new KeyList([localnet1002.publicKey, localnet2.publicKey]));

  const fileCreate2 = new FileCreateTransaction()
    .setTransactionId(createTransactionId(localnet1003.accountId))
    .setKeys(new KeyList([localnet1003.publicKey, localnet1003.publicKey]));

  const transactions = [
    {
      name: 'Simple Account Create Transaction',
      description: 'This is a simple account create transaction',
      body: Buffer.from(accountCreate.toBytes()),
      creatorKeyId: userKey1003.id,
      signature: Buffer.from(localnet1003.privateKey.sign(accountCreate.toBytes())),
      network: localnet1003.network,
    },
    {
      name: 'Simple Account Update Transaction',
      description: 'This is a simple account update transaction',
      body: Buffer.from(accountUpdate.toBytes()),
      creatorKeyId: userKey1004.id,
      signature: Buffer.from(localnet1004.privateKey.sign(accountUpdate.toBytes())),
      network: localnet1004.network,
    },
    {
      name: 'Simple File Create Transaction',
      description: 'This is a simple file create transaction',
      body: Buffer.from(fileCreate.toBytes()),
      creatorKeyId: adminKey1002.id,
      signature: Buffer.from(localnet1002.privateKey.sign(fileCreate.toBytes())),
      network: localnet1002.network,
    },
    {
      name: 'Second simple File Create Transaction',
      description: 'This is a second simple file create transaction',
      body: Buffer.from(fileCreate2.toBytes()),
      creatorKeyId: userKey1003.id,
      signature: Buffer.from(localnet1003.privateKey.sign(fileCreate.toBytes())),
      network: localnet1003.network,
    },
  ];

  for (const transaction of transactions) {
    await transactionRepo.save(transaction);
  }

  console.log(chalk.green('Transactions added successfully \n'));
}

export async function getTransactions(dataSource: DataSource) {
  const transactionRepo = dataSource.getRepository(Transaction);

  try {
    return await transactionRepo.find();
  } catch (error) {
    console.log(chalk.red(error.message));
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

export async function withDataSource<T>(callback: (dataSource: DataSource, ...args) => T, ...args) {
  const dataSource = await connectDatabase();

  try {
    return await callback(dataSource, ...args);
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
