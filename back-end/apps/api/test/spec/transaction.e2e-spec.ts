import { NestExpressApplication } from '@nestjs/platform-express';

import { Repository } from 'typeorm';
import { AccountCreateTransaction } from '@hashgraph/sdk';

import {
  Network,
  TransactionStatus,
  User,
  UserStatus,
  Transaction,
  TransactionType,
} from '@entities';

import { closeApp, createNestApp, login } from '../utils';
import {
  addHederaLocalnetAccounts,
  addTransactions,
  createUser,
  getRepository,
  getUser,
  getUserKey,
  resetDatabase,
  resetUsersState,
} from '../utils/databaseUtil';
import { Endpoint } from '../utils/httpUtils';
import { createTransactionId, localnet1003, localnet2 } from '../utils/hederaUtils';
import { HederaAccount } from '../utils/models';

describe('Transactions (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;

  let repo: Repository<Transaction>;

  let adminAuthCookie: string;
  let userAuthCookie: string;
  let userNewAuthCookie: string;
  let admin: User;
  let user: User;

  let addedTransactions: {
    userTransactions: Transaction[];
    adminTransactions: Transaction[];
    total: number;
  };

  let testsAddedTransactionsCount = 0;

  const createTransaction = async (u?: User, account?: HederaAccount) => {
    const transaction = new AccountCreateTransaction()
      .setTransactionId(createTransactionId((account || localnet1003).accountId))
      .setKey((account || localnet1003).publicKey)
      .setAccountMemo('This is a memo');
    const buffer = Buffer.from(transaction.toBytes()).toString('hex');

    const userKey = await getUserKey((u || user).id, (account || localnet1003).publicKeyRaw);

    if (userKey === null) {
      throw new Error('User key not found');
    }

    return {
      name: 'TEST Simple Account Create Transaction',
      description: 'TEST This is a simple account create transaction',
      body: buffer,
      creatorKeyId: userKey.id,
      signature: Buffer.from(
        (account || localnet1003).privateKey.sign(transaction.toBytes()),
      ).toString('hex'),
      network: (account || localnet1003).network,
    };
  };

  beforeAll(async () => {
    await resetDatabase();
    await addHederaLocalnetAccounts();
    addedTransactions = await addTransactions();

    repo = await getRepository(Transaction);
  });

  beforeEach(async () => {
    app = await createNestApp();
    server = app.getHttpServer();

    adminAuthCookie = await login(app, 'admin');
    userAuthCookie = await login(app, 'user');
    userNewAuthCookie = await login(app, 'userNew');

    admin = await getUser('admin');
    user = await getUser('user');
  });

  afterEach(async () => {
    await resetUsersState();
    await closeApp(app);
  });

  describe('/transactions', () => {
    let endpoint: Endpoint;

    beforeEach(() => {
      endpoint = new Endpoint(server, '/transactions');
    });

    it('(POST) should create a simple account create transaction', async () => {
      const transaction = await createTransaction();

      const { status, body } = await endpoint.post(transaction, null, userAuthCookie);
      testsAddedTransactionsCount++;

      expect(status).toEqual(201);
      expect(body.body).not.toEqual(transaction.body);
      expect(body).toMatchObject(
        expect.objectContaining({
          name: transaction.name,
          description: transaction.description,
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          creatorKeyId: transaction.creatorKeyId,
        }),
      );
    });

    it('(POST) should not create a transaction if user is not verified', async () => {
      const countBefore = await repo.count();
      await endpoint.post(await createTransaction(), null, userNewAuthCookie).expect(403);
      const countAfter = await repo.count();

      expect(countAfter).toEqual(countBefore);
    });

    it('(POST) should not create a transaction if user has no keys', async () => {
      const countBefore = await repo.count();
      const transaction = await createTransaction();

      const user = await createUser('test@test.com', '1234567890', false, UserStatus.NONE);
      const cookie = await login(app, { ...user, password: '1234567890' });

      const { status } = await endpoint.post(transaction, null, cookie);
      const countAfter = await repo.count();

      expect(status).toEqual(401);
      // expect(body).toMatchObject(
      //   expect.objectContaining({
      //     message: 'You should have at least one key to perform this action.',
      //   }),
      // );
      expect(countAfter).toEqual(countBefore);
    });

    it('(POST) should not create transaction if not logged in', async () => {
      const countBefore = await repo.count();
      await endpoint.post(await createTransaction()).expect(401);
      const countAfter = await repo.count();

      expect(countAfter).toEqual(countBefore);
    });

    it("(POST) should not create transaction with other user's key", async () => {
      const countBefore = await repo.count();
      const transaction = await createTransaction(admin, localnet2);

      const { status } = await endpoint.post(transaction, null, userAuthCookie);
      const countAfter = await repo.count();

      expect(status).toEqual(400);
      // expect(body).toMatchObject(
      //   expect.objectContaining({
      //     message: "Creator key doesn't belong to the user",
      //   }),
      // );
      expect(countAfter).toEqual(countBefore);
    });

    it('(POST) should not create transaction with invalid network', async () => {
      const countBefore = await repo.count();
      const transaction = await createTransaction();
      transaction.network = 'some-network' as Network;

      const { status } = await endpoint.post(transaction, null, userAuthCookie);
      const countAfter = await repo.count();

      expect(status).toEqual(400);
      // expect(body).toMatchObject(
      //   expect.objectContaining({
      //     message: [
      //       'network must be one of the following values: mainnet, testnet, previewnet, local-node',
      //     ],
      //   }),
      // );
      expect(countAfter).toEqual(countBefore);
    });

    it('(POST) should not create a transaction with invalid creator signature', async () => {
      const countBefore = await repo.count();
      const transaction = await createTransaction();
      transaction.signature = 'invalid-signature';

      const { status } = await endpoint.post(transaction, null, userAuthCookie);
      const countAfter = await repo.count();

      expect(status).toEqual(400);
      // expect(body).toMatchObject(
      //   expect.objectContaining({
      //     message: 'The signature does not match the public key',
      //   }),
      // );
      expect(countAfter).toEqual(countBefore);
    });

    it('(POST) should not create a transaction without name, description, creatorKeyId, or network', async () => {
      const countBefore = await repo.count();
      const transaction = await createTransaction();

      delete transaction.name;
      delete transaction.description;
      delete transaction.creatorKeyId;
      delete transaction.network;

      const { status } = await endpoint.post(transaction, null, userAuthCookie);
      const countAfter = await repo.count();

      expect(status).toEqual(400);
      // expect(body).toMatchObject(
      //   expect.objectContaining({
      //     message: [
      //       'name must be a string',
      //       'description must be a string',
      //       'creatorKeyId must be a number conforming to the specified constraints',
      //       'network must be one of the following values: mainnet, testnet, previewnet, local-node',
      //       'network should not be empty',
      //     ],
      //   }),
      // );
      expect(countAfter).toEqual(countBefore);
    });

    it('(POST) should not create a transaction with an invalid body', async () => {
      const countBefore = await repo.count();
      const { status } = await endpoint.post({ body: 'invalid' }, null, userAuthCookie);
      const countAfter = await repo.count();

      expect(status).toEqual(400);
      expect(countAfter).toEqual(countBefore);
    });

    it('(POST) should not create a duplicating transaction', async () => {
      const transaction = await createTransaction();

      await endpoint.post(transaction, null, userAuthCookie);

      const countBefore = await repo.count();
      const { status } = await endpoint.post(transaction, null, userAuthCookie);
      const countAfter = await repo.count();

      testsAddedTransactionsCount++;

      expect(status).toEqual(400);
      // expect(body).toMatchObject(
      //   expect.objectContaining({
      //     message: 'Transaction already exists',
      //   }),
      // );
      expect(countAfter).toEqual(countBefore);
    });

    it('(POST) should not create an expired transaction', async () => {
      const countBefore = await repo.count();
      const transaction = new AccountCreateTransaction().setTransactionId(
        createTransactionId(localnet1003.accountId, new Date(Date.now() - 1000 * 60 * 10)),
      );
      const buffer = Buffer.from(transaction.toBytes()).toString('hex');

      const userKey = await getUserKey(user.id, localnet1003.publicKeyRaw);

      if (userKey === null) throw new Error('User key not found');

      const dto = {
        name: 'Simple Account Create Transaction',
        description: 'This is a simple account create transaction',
        body: buffer,
        creatorKeyId: userKey.id,
        signature: Buffer.from(localnet1003.privateKey.sign(transaction.toBytes())).toString('hex'),
        network: localnet1003.network,
      };

      const { status } = await endpoint.post(dto, null, userAuthCookie);
      const countAfter = await repo.count();

      expect(status).toEqual(400);
      // expect(body).toMatchObject(
      //   expect.objectContaining({
      //     message: 'Transaction is expired',
      //   }),
      // );
      expect(countAfter).toEqual(countBefore);
    });

    it('(GET) should get all transactions for user', async () => {
      const { status, body } = await endpoint.get(null, userAuthCookie, 'page=1&size=99');

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(
        addedTransactions.userTransactions.length + testsAddedTransactionsCount,
      );
    });

    it('(GET) should get all transactions for admin', async () => {
      const { status, body } = await endpoint.get(null, adminAuthCookie, 'page=1&size=99');

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(addedTransactions.adminTransactions.length);
    });

    it('(GET) should get all file create transactions', async () => {
      const { status, body } = await endpoint.get(
        null,
        userAuthCookie,
        `page=1&size=99&filter=type:eq:${TransactionType.FILE_CREATE}`,
      );
      const { status: status2, body: body2 } = await endpoint.get(
        null,
        adminAuthCookie,
        `page=1&size=99&filter=type:eq:${TransactionType.FILE_CREATE}`,
      );

      expect(status).toEqual(200);
      expect(body.items.every(t => t.type === TransactionType.FILE_CREATE)).toEqual(true);
      expect(body.totalItems).toEqual(
        addedTransactions.userTransactions.filter(t => t.type === TransactionType.FILE_CREATE)
          .length,
      );

      expect(status2).toEqual(200);
      expect(body.items.every(t => t.type === TransactionType.FILE_CREATE)).toEqual(true);
      expect(body2.totalItems).toEqual(
        addedTransactions.adminTransactions.filter(t => t.type === TransactionType.FILE_CREATE)
          .length,
      );
    });

    it('(GET) should get paginated transactions', async () => {
      const { status, body } = await endpoint.get(null, userAuthCookie, 'page=1&size=2');

      expect(status).toEqual(200);
      expect(body.items.length).toEqual(2);
    });
  });

  describe('/transactions/history', () => {
    let endpoint: Endpoint;

    const allowedStatuses = [
      TransactionStatus.EXECUTED,
      TransactionStatus.FAILED,
      TransactionStatus.EXPIRED,
      TransactionStatus.CANCELED,
    ];
    const forbiddenStatuses = Object.values(TransactionStatus).filter(
      s => !allowedStatuses.includes(s),
    );

    const getRandomStatus = () =>
      allowedStatuses[Math.floor(Math.random() * allowedStatuses.length)];

    beforeAll(async () => {
      await resetDatabase();
      await addHederaLocalnetAccounts();
      addedTransactions = await addTransactions();

      for (let i = 0; i < addedTransactions.userTransactions.length; i++) {
        const transaction = addedTransactions.userTransactions[i];
        const status = getRandomStatus();
        await repo.update({ id: transaction.id }, { status });
        addedTransactions.userTransactions[i].status = status;
      }
      for (let i = 0; i < addedTransactions.adminTransactions.length; i++) {
        const transaction = addedTransactions.adminTransactions[i];
        const status = getRandomStatus();
        await repo.update({ id: transaction.id }, { status });
        addedTransactions.adminTransactions[i].status = status;
      }
    });

    afterAll(async () => {
      await resetDatabase();
      await addHederaLocalnetAccounts();
      addedTransactions = await addTransactions();
    });

    beforeEach(() => {
      endpoint = new Endpoint(server, '/transactions/history');
    });

    it('(GET) should get all transactions that are visible to everyone', async () => {
      const { status, body } = await endpoint.get(null, userAuthCookie, 'page=1&size=99');

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(addedTransactions.total);
    });

    it('(GET) should get all transactions that are visible to everyone with filtering', async () => {
      const { status, body } = await endpoint.get(
        null,
        userAuthCookie,
        `page=1&size=99&filter=status:eq:${TransactionStatus.EXECUTED}`,
      );
      const actualExpired = addedTransactions.userTransactions
        .concat(addedTransactions.adminTransactions)
        .filter(t => t.status === TransactionStatus.EXECUTED);

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(actualExpired.length);
    });

    it('(GET) should not get transactions if not verified', async () => {
      await endpoint.get(null, userNewAuthCookie, 'page=1&size=99').expect(403);
    });

    it('(GET) should get paginated transactions', async () => {
      const { status, body } = await endpoint.get(null, userAuthCookie, 'page=1&size=2');

      expect(status).toEqual(200);
      expect(body.items.length).toEqual(2);
    });

    it('(GET) should not get transactions if not logged in', async () => {
      await endpoint.get(null, null).expect(401);
    });

    it('(GET) should not get forbidden transactions', async () => {
      const { status, body } = await endpoint.get(
        null,
        userAuthCookie,
        `page=1&size=99&filter=status:in:${forbiddenStatuses.join(', ')}`,
      );

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(0);
    });
  });

  describe('/transactions/sign', () => {
    let endpoint: Endpoint;

    beforeEach(() => {
      endpoint = new Endpoint(server, '/transactions/sign');
    });

    it('(GET) should get all transactions to sign', async () => {
      /* User has created 3 transactions that need his signatures */
      const { status, body } = await endpoint.get(null, userAuthCookie, 'page=1&size=99');

      /* Admin has created 1 transaction that needs his signature, but one of the user created transaction requires admin's key signature */
      const { status: status2, body: body2 } = await endpoint.get(
        null,
        adminAuthCookie,
        'page=1&size=99',
      );

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(3);

      expect(status2).toEqual(200);
      expect(body2.totalItems).toEqual(2);
    });

    it('(GET) should get paginated transactions', async () => {
      const { status, body } = await endpoint.get(null, userAuthCookie, 'page=1&size=2');

      expect(status).toEqual(200);
      expect(body.items.length).toEqual(2);
    });

    it('(GET) should not get transactions to sign if not verified', async () => {
      await endpoint.get(null, userNewAuthCookie, 'page=1&size=99').expect(403);
    });

    it('(GET) should not get transactions to sign if not logged in', async () => {
      await endpoint.get(null, null).expect(401);
    });
  });
});
