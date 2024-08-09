import { NestExpressApplication } from '@nestjs/platform-express';

import { Repository } from 'typeorm';
import { AccountCreateTransaction } from '@hashgraph/sdk';

import { TransactionStatus, User, Transaction, Role, TransactionObserver } from '@entities';

import { closeApp, createNestApp, login } from '../utils';
import {
  addHederaLocalnetAccounts,
  addTransactions,
  getRepository,
  getUser,
  getUserKey,
  resetDatabase,
  resetUsersState,
} from '../utils/databaseUtil';
import { Endpoint } from '../utils/httpUtils';
import { createTransactionId, localnet1002, localnet1003 } from '../utils/hederaUtils';
import { HederaAccount } from '../utils/models';

describe('Transaction Observers (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;

  let transactionRepo: Repository<Transaction>;
  let transactionObserverRepo: Repository<TransactionObserver>;

  let adminAuthCookie: string;
  let userAuthCookie: string;
  let userNewAuthCookie: string;
  let user: User;
  let userNew: User;

  let addedTransactions: Awaited<ReturnType<typeof addTransactions>>;

  const createTransaction = async (
    usr: User,
    usrAccount: HederaAccount,
    account: HederaAccount,
  ) => {
    const transaction = new AccountCreateTransaction()
      .setTransactionId(createTransactionId(account.accountId))
      .setKey(account.publicKey)
      .setAccountMemo('This is a memo');
    const buffer = Buffer.from(transaction.toBytes()).toString('hex');

    const userKey = await getUserKey(usr.id, usrAccount.publicKeyRaw);

    if (userKey === null) {
      throw new Error('User key not found');
    }

    return {
      name: 'TEST Simple Account Create Transaction',
      description: 'TEST This is a simple account create transaction',
      body: buffer,
      creatorKeyId: userKey.id,
      signature: Buffer.from(usrAccount.privateKey.sign(transaction.toBytes())).toString('hex'),
      network: usrAccount.network,
    };
  };

  beforeAll(async () => {
    await resetDatabase();
    await addHederaLocalnetAccounts();
    addedTransactions = await addTransactions();

    transactionRepo = await getRepository(Transaction);
    transactionObserverRepo = await getRepository(TransactionObserver);
  });

  beforeEach(async () => {
    app = await createNestApp();
    server = app.getHttpServer();

    adminAuthCookie = await login(app, 'admin');
    userAuthCookie = await login(app, 'user');
    userNewAuthCookie = await login(app, 'userNew');

    user = await getUser('user');
    userNew = await getUser('userNew');
  });

  afterEach(async () => {
    await resetUsersState();
    await closeApp(app);
  });

  describe('/transactions/:transactionId/observers', () => {
    let endpoint: Endpoint;

    beforeEach(() => {
      endpoint = new Endpoint(server, '/transactions');
    });

    it('(POST) should add observers to a transaction', async () => {
      const transaction = addedTransactions.adminTransactions[0];

      const { status, body } = await endpoint.post(
        {
          userIds: [user.id],
        },
        `/${transaction.id}/observers`,
        adminAuthCookie,
      );

      expect(status).toBe(201);
      expect(body).toEqual([
        {
          id: expect.any(Number),
          transactionId: transaction.id,
          userId: user.id,
          role: Role.FULL,
          createdAt: expect.any(String),
        },
      ]);
    });

    it('(POST) should NOT add an observer if already added', async () => {
      const transaction = addedTransactions.adminTransactions[0];

      const { status, body } = await endpoint.post(
        {
          userIds: [user.id, userNew.id],
        },
        `/${transaction.id}/observers`,
        adminAuthCookie,
      );

      expect(status).toBe(201);
      expect(body).toEqual([
        {
          id: expect.any(Number),
          transactionId: transaction.id,
          userId: userNew.id,
          role: Role.FULL,
          createdAt: expect.any(String),
        },
      ]);
    });

    it('(POST) should NOT add an observer if not creator of the transaction', async () => {
      const transaction = addedTransactions.userTransactions[0];

      const { status, body } = await endpoint.post(
        {
          userIds: [user.id],
        },
        `/${transaction.id}/observers`,
        adminAuthCookie,
      );

      expect(status).toBe(401);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 401,
          error: 'Unauthorized',
        }),
      );
    });

    it('(POST) should NOT add an observer if invalid body', async () => {
      const transaction = addedTransactions.adminTransactions[0];

      const { status, body } = await endpoint.post(
        {},
        `/${transaction.id}/observers`,
        adminAuthCookie,
      );

      expect(status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          // message: ['userIds must be an array'],
        }),
      );
    });

    it('(POST) should THROW if trying to add an observer to a transaction that does not exist', async () => {
      const { status, body } = await endpoint.post(
        {
          userIds: [user.id],
        },
        '/999/observers',
        adminAuthCookie,
      );

      expect(status).toBe(404);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 404,
        }),
      );
    });

    it('(GET) should get transaction observers if user has access (is creator)', async () => {
      const transaction = addedTransactions.adminTransactions[0];

      const { status, body } = await endpoint.get(`/${transaction.id}/observers`, adminAuthCookie);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            transactionId: transaction.id,
            userId: user.id,
            role: Role.FULL,
            createdAt: expect.any(String),
          }),
        ]),
      );
    });

    it.todo('(GET) should get transaction observers if user has access (is signer)');

    it('(GET) should get transaction observers if user has access (is observer)', async () => {
      const transaction = addedTransactions.adminTransactions[0];

      const { status, body } = await endpoint.get(`/${transaction.id}/observers`, userAuthCookie);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            transactionId: transaction.id,
            userId: user.id,
            role: Role.FULL,
            createdAt: expect.any(String),
          }),
        ]),
      );
    });

    it('(GET) should get transaction observers if user has access (should sign)', async () => {
      const transaction = await createTransaction(user, localnet1003, localnet1002);
      const createTxRes = await endpoint.post(transaction, null, userAuthCookie);
      await endpoint.post(
        {
          userIds: [userNew.id],
        },
        `/${createTxRes.body.id}/observers`,
        userAuthCookie,
      );

      const getObserversRes = await endpoint.get(
        `/${createTxRes.body.id}/observers`,
        adminAuthCookie,
      );

      expect(createTxRes.status).toBe(201);
      expect(getObserversRes.status).toBe(200);
      expect(getObserversRes.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            transactionId: createTxRes.body.id,
            userId: userNew.id,
            role: Role.FULL,
            createdAt: expect.any(String),
          }),
        ]),
      );
    });

    it('(GET) should get transaction observers if transaction is in a visible status', async () => {
      const visibleStatuses = [
        TransactionStatus.EXECUTED,
        TransactionStatus.EXPIRED,
        TransactionStatus.FAILED,
        TransactionStatus.CANCELED,
      ];

      const transaction = await createTransaction(user, localnet1003, localnet1003);
      const createTxRes = await endpoint.post(transaction, null, userAuthCookie);
      await transactionRepo.update(
        {
          id: createTxRes.body.id,
        },
        { status: visibleStatuses[0] },
      );
      await endpoint.post(
        {
          userIds: [userNew.id],
        },
        `/${createTxRes.body.id}/observers`,
        userAuthCookie,
      );

      const getObserversRes = await endpoint.get(
        `/${createTxRes.body.id}/observers`,
        adminAuthCookie,
      );

      expect(createTxRes.status).toBe(201);
      expect(getObserversRes.status).toBe(200);
      expect(getObserversRes.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            transactionId: createTxRes.body.id,
            userId: userNew.id,
            role: Role.FULL,
            createdAt: expect.any(String),
          }),
        ]),
      );
    });

    it('(GET) should NOT get transaction observers if transaction is in a NOT visible status', async () => {
      const transaction = await createTransaction(user, localnet1003, localnet1003);
      const createTxRes = await endpoint.post(transaction, null, userAuthCookie);
      await endpoint.post(
        {
          userIds: [userNew.id],
        },
        `/${createTxRes.body.id}/observers`,
        userAuthCookie,
      );

      const getObserversRes = await endpoint.get(
        `/${createTxRes.body.id}/observers`,
        adminAuthCookie,
      );
      console.log(getObserversRes.body);

      expect(createTxRes.status).toBe(201);
      expect(getObserversRes.status).toBe(401);
      expect(getObserversRes.body).toEqual({
        message: "You don't have permission to view this transaction",
        error: 'Unauthorized',
        statusCode: 401,
      });
    });

    it('(GET) should NOT get transaction observers if user is not verified', async () => {
      const transaction = addedTransactions.adminTransactions[0];

      const { status, body } = await endpoint.get(
        `/${transaction.id}/observers`,
        userNewAuthCookie,
      );

      expect(status).toBe(403);
      expect(body).toEqual({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Forbidden resource',
      });
    });

    it('(GET) should NOT get transaction observers if user is not logged in', async () => {
      const transaction = addedTransactions.adminTransactions[0];

      const { status, body } = await endpoint.get(`/${transaction.id}/observers`);

      expect(status).toBe(401);
      expect(body).toEqual({
        statusCode: 401,
        message: 'Unauthorized',
      });
    });

    it('(GET) should NOT get transaction observers if transaction does not exist', async () => {
      const { status, body } = await endpoint.get('/999/observers', adminAuthCookie);

      expect(status).toBe(404);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 404,
          // message: 'Route not found',
        }),
      );
    });

    it.todo('(GET) should get transaction observers if user has access (is approver)');

    it('(PATCH) should update transaction observer', async () => {
      const transaction = addedTransactions.adminTransactions[0];
      const userObserverEntry = await transactionObserverRepo.findOne({
        where: { transactionId: transaction.id, userId: user.id },
      });

      const { status, body } = await endpoint.patch(
        {
          role: Role.APPROVER,
        },
        `/${transaction.id}/observers/${userObserverEntry.id}`,
        adminAuthCookie,
      );

      expect(userObserverEntry).toBeDefined();
      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          transactionId: transaction.id,
          userId: user.id,
          role: Role.APPROVER,
          createdAt: expect.any(String),
        }),
      );
    });

    it('(PATCH) should NOT update transaction observer if invalid body', async () => {
      const transaction = addedTransactions.adminTransactions[0];
      const userObserverEntry = await transactionObserverRepo.findOne({
        where: { transactionId: transaction.id, userId: user.id },
      });

      const { status, body } = await endpoint.patch(
        {},
        `/${transaction.id}/observers/${userObserverEntry.id}`,
        adminAuthCookie,
      );

      expect(status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          // message: ['role must be a valid enum value'],
        }),
      );
    });

    it('(PATCH) should NOT update transaction observer if user is not creator', async () => {
      const transaction = addedTransactions.adminTransactions[0];
      const userObserverEntry = await transactionObserverRepo.findOne({
        where: { transactionId: transaction.id, userId: user.id },
      });

      const { status, body } = await endpoint.patch(
        {
          role: Role.APPROVER,
        },
        `/${transaction.id}/observers/${userObserverEntry.id}`,
        userAuthCookie,
      );

      expect(status).toBe(401);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 401,
          error: 'Unauthorized',
        }),
      );
    });

    it('(DELETE) should NOT delete transaction observer if user is not creator', async () => {
      const transaction = addedTransactions.adminTransactions[0];
      const userObserverEntry = await transactionObserverRepo.findOne({
        where: { transactionId: transaction.id, userId: user.id },
      });

      const { status, body } = await endpoint.delete(
        `/${transaction.id}/observers/${userObserverEntry.id}`,
        userAuthCookie,
      );

      expect(status).toBe(401);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 401,
          error: 'Unauthorized',
        }),
      );
    });

    it('(DELETE) should delete transaction observer', async () => {
      const transaction = addedTransactions.adminTransactions[0];
      const userObserverEntry = await transactionObserverRepo.findOne({
        where: { transactionId: transaction.id, userId: user.id },
      });

      const { status } = await endpoint.delete(
        `/${transaction.id}/observers/${userObserverEntry.id}`,
        adminAuthCookie,
      );

      expect(status).toBe(200);
    });

    it('(DELETE) should NOT delete transaction observer if transaction does not exist', async () => {
      const { status, body } = await endpoint.delete('/999/observers/999', adminAuthCookie);

      expect(status).toBe(404);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 404,
        }),
      );
    });
  });
});
