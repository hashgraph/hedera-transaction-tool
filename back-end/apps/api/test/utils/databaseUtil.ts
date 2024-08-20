import * as chalk from 'chalk';
import * as bcrypt from 'bcryptjs';

import { DataSource, DeepPartial, EntityTarget, ObjectLiteral } from 'typeorm';
import {
  AccountCreateTransaction,
  AccountUpdateTransaction,
  Client,
  FileCreateTransaction,
  KeyList,
  Transaction as SDKTransaction,
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
  TransactionStatus,
  Notification,
  NotificationPreferences,
  NotificationReceiver,
  NotificationType,
} from '../../../../libs/common/src/database/entities';

import {
  createTransactionId,
  generatePrivateKey,
  getTransactionTypeEnumValue,
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

let _dataSource: DataSource;

export async function getDataSource() {
  if (!_dataSource) {
    _dataSource = await connectDatabase();
  }

  return _dataSource;
}

export const destroyDataSource = async () => {
  if (_dataSource) {
    await _dataSource.destroy();
    _dataSource = null;
  }
};

export const getRepository = async <Entity extends ObjectLiteral>(target: EntityTarget<Entity>) => {
  const dataSource = await getDataSource();
  return dataSource.getRepository(target);
};

export async function createUser(
  email: string = 'admin@test.com',
  password: string = '1234567890',
  admin: boolean = false,
  status: UserStatus = UserStatus.NONE,
) {
  const userRepo = await getRepository(User);

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

export async function attachKeyToUser(userId: number, key: DeepPartial<UserKey>) {
  const userKeyRepo = await getRepository(UserKey);

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
  const admin = await createUser(adminEmail, adminPassword, true);
  const user = await createUser(dummyEmail, dummyPassword, false);
  const userNew = await createUser(dummyNewEmail, dummyNewPassword, false, UserStatus.NEW);

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

  await attachKeyToUser(admin.id, {
    publicKey: publicKeyRaw,
    mnemonicHash,
    index,
  });

  await attachKeyToUser(user.id, {
    publicKey: publicKeyRaw1,
    mnemonicHash: mnemonicHash1,
    index: index1,
  });

  console.log(chalk.green('Users added successfully \n'));
  console.log(`Id: ${admin.id}, Admin: ${admin.email}, ${adminPassword}, ${publicKeyRaw}`);
  console.log(`Id: ${user.id}, User: ${user.email}, ${dummyPassword}, ${publicKeyRaw1} \n`);
  console.log(`Id: ${userNew.id}, User: ${userNew.email}, ${dummyNewPassword} \n`);
}

export async function addHederaLocalnetAccounts() {
  const admin = await getUser('admin');
  const user = await getUser('user');

  if (!admin || !user) {
    console.log(chalk.red('Failed to add users'));
    return;
  }

  for (const account of [localnet2, localnet1002, localnet1022]) {
    await attachKeyToUser(admin.id, {
      publicKey: account.publicKeyRaw,
    });
  }

  for (const account of [localnet1003, localnet1004]) {
    await attachKeyToUser(user.id, {
      publicKey: account.publicKeyRaw,
    });
  }
}

export async function resetUsersState() {
  const userRepo = await getRepository(User);

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
}

export async function getUsers() {
  const userRepo = await getRepository(User);

  try {
    return userRepo.find();
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

export async function getUserKeys(id?: number) {
  const userKeyRepo = await getRepository(UserKey);

  try {
    return await userKeyRepo.find(
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
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

export async function getUserKey(userId: number, publicKey: string) {
  const userKeyRepo = await getRepository(UserKey);

  try {
    const userKey = await userKeyRepo.findOne({
      where: {
        user: {
          id: userId,
        },
        publicKey,
      },
    });
    return userKey;
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

export async function getUser(type: 'admin' | 'user' | 'userNew') {
  const userRepo = await getRepository(User);

  try {
    return await userRepo.findOne({
      where: {
        email: type === 'admin' ? adminEmail : type === 'user' ? dummyEmail : dummyNewEmail,
      },
    });
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

export async function clearUsers() {
  const userRepo = await getRepository(User);
  const userKeyRepo = await getRepository(UserKey);

  try {
    await userKeyRepo.delete({});
    await userRepo.delete({});
    console.log(chalk.green('Users cleared successfully \n'));
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

export async function addTransactions() {
  const dataSource = await getDataSource();
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
    .setKey(new KeyList([localnet1004.publicKey, localnet1002.publicKey]));

  const fileCreate = new FileCreateTransaction()
    .setTransactionId(createTransactionId(localnet1002.accountId))
    .setKeys(new KeyList([localnet1002.publicKey, localnet2.publicKey]));

  const fileCreate2 = new FileCreateTransaction()
    .setTransactionId(createTransactionId(localnet1003.accountId, new Date(Date.now() + 1000)))
    .setKeys(new KeyList([localnet1003.publicKey, localnet1003.publicKey]));

  const userTransactions = [
    transactionRepo.create({
      name: '#1 Simple Account Create Transaction',
      description: 'This is a simple account create transaction',
      body: Buffer.from(accountCreate.toBytes()),
      creatorKey: { id: userKey1003.id },
      signature: Buffer.from(localnet1003.privateKey.sign(accountCreate.toBytes())),
      network: localnet1003.network,
    }),
    transactionRepo.create({
      name: '#2 Simple Account Update Transaction',
      description: 'This is a simple account update transaction',
      body: Buffer.from(accountUpdate.toBytes()),
      creatorKey: { id: userKey1004.id },
      signature: Buffer.from(localnet1004.privateKey.sign(accountUpdate.toBytes())),
      network: localnet1004.network,
    }),
    transactionRepo.create({
      name: '#4 Second simple File Create Transaction',
      description: 'This is a second simple file create transaction',
      body: Buffer.from(fileCreate2.toBytes()),
      creatorKey: { id: userKey1003.id },
      signature: Buffer.from(localnet1003.privateKey.sign(fileCreate.toBytes())),
      network: localnet1003.network,
    }),
  ];

  const adminTransactions = [
    transactionRepo.create({
      name: '#3 Simple File Create Transaction',
      description: 'This is a simple file create transaction',
      body: Buffer.from(fileCreate.toBytes()),
      creatorKey: { id: adminKey1002.id },
      signature: Buffer.from(localnet1002.privateKey.sign(fileCreate.toBytes())),
      network: localnet1002.network,
    }),
  ];

  const client = Client.forLocalNode();

  for (const transaction of userTransactions.concat(adminTransactions)) {
    const sdkTransaction = SDKTransaction.fromBytes(transaction.body);
    sdkTransaction.freezeWith(client);

    transaction.type = getTransactionTypeEnumValue(sdkTransaction);
    transaction.transactionId = sdkTransaction.transactionId.toString();
    transaction.body = Buffer.from(sdkTransaction.toBytes());
    transaction.transactionHash = Buffer.from(await sdkTransaction.getTransactionHash()).toString(
      'hex',
    );
    transaction.status = TransactionStatus.WAITING_FOR_SIGNATURES;
    transaction.validStart = sdkTransaction.transactionId.validStart.toDate();

    try {
      await transactionRepo.save(transaction);
    } catch (error) {
      console.error(error);
    }
  }

  client.close();

  console.log(chalk.green('Transactions added successfully \n'));

  return {
    userTransactions,
    adminTransactions,
    userToSignCount: 3,
    adminToSignCount: 2,
    total: userTransactions.length + adminTransactions.length,
  };
}

export async function getTransactions() {
  const dataSource = await getDataSource();
  const transactionRepo = dataSource.getRepository(Transaction);

  try {
    return await transactionRepo.find();
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

export async function addNotifications() {
  const notificationsRepo = await getRepository(Notification);
  const notificationReceiverRepo = await getRepository(NotificationReceiver);

  const notification = notificationsRepo.create({
    content: 'A transaction #1 has been created',
    entityId: 1,
    type: NotificationType.TRANSACTION_CREATED,
  });
  const notification2 = notificationsRepo.create({
    content: 'A transaction #2 has been created',
    entityId: 2,
    type: NotificationType.TRANSACTION_CREATED,
  });
  const notification3 = notificationsRepo.create({
    content: 'A transaction #2 is ready for execution',
    entityId: 2,
    type: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
  });

  try {
    await notificationsRepo.save(notification);
    await notificationsRepo.save(notification2);
    await notificationsRepo.save(notification3);
    console.log(chalk.green('Notifications added successfully \n'));
  } catch (error) {
    console.log(chalk.red(error.message));
    return;
  }

  const user = await getUser('user');
  const admin = await getUser('admin');

  if (!user || !admin) {
    console.log(chalk.red('Failed to add notifications'));
    return;
  }

  const notificationReceiver = notificationReceiverRepo.create({
    userId: admin.id,
    notificationId: notification.id,
    isRead: false,
  });
  const notificationReceiver2 = notificationReceiverRepo.create({
    userId: user.id,
    notificationId: notification2.id,
    isRead: false,
  });
  const notificationReceiver3 = notificationReceiverRepo.create({
    userId: user.id,
    notificationId: notification3.id,
    isRead: false,
  });

  try {
    await notificationReceiverRepo.save(notificationReceiver);
    await notificationReceiverRepo.save(notificationReceiver2);
    await notificationReceiverRepo.save(notificationReceiver3);
    console.log(chalk.green('Notification receivers added successfully \n'));
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

export async function resetDatabase() {
  const dataSource = await getDataSource();

  try {
    await dataSource.synchronize(true);

    await addUsers();

    console.log(chalk.green('Database reset successfully \n'));
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

export async function withDisposableDataSource<T>(
  callback: (dataSource: DataSource, ...args) => T,
  ...args
) {
  verifyEnv();

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
      Notification,
      NotificationReceiver,
      NotificationPreferences,
    ],
  });

  await dataSource.initialize();

  console.log(chalk.cyan.underline('Connected to database \n'));

  return dataSource;
}
