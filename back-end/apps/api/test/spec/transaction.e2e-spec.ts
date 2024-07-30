import { NestExpressApplication } from '@nestjs/platform-express';

import { AccountCreateTransaction } from '@hashgraph/sdk';

import { Network, TransactionStatus, User, UserStatus } from '@entities';

import { closeApp, createNestApp, login } from '../utils';
import {
  addHederaLocalnetAccounts,
  addTransactions,
  createUser,
  getUser,
  getUserKey,
  resetDatabase,
  resetUsersState,
  withDataSource,
} from '../utils/databaseUtil';
import { Endpoint } from '../utils/httpUtils';
import { createTransactionId, localnet1003, localnet2 } from '../utils/hederaUtils';
import { HederaAccount } from '../utils/models';

describe('Transactions (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;

  let adminAuthCookie: string;
  let userAuthCookie: string;
  let userNewAuthCookie: string;
  let admin: User;
  let user: User;

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
      name: 'Simple Account Create Transaction',
      description: 'This is a simple account create transaction',
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
    await withDataSource(addTransactions);
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

      expect(status).toBe(201);
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
      return endpoint.post(await createTransaction(), null, userNewAuthCookie).expect(403);
    });

    it('(POST) should not create a transaction if user has no keys', async () => {
      const transaction = await createTransaction();

      const user = await createUser('test@test.com', '1234567890', null, false, UserStatus.NONE);
      const cookie = await login(app, { ...user, password: '1234567890' });

      const { status, body } = await endpoint.post(transaction, null, cookie);

      expect(status).toBe(401);
      expect(body).toMatchObject(
        expect.objectContaining({
          message: 'You should have at least one key to perform this action.',
        }),
      );
    });

    it('(POST) should not create transaction if not logged in', async () =>
      endpoint.post(await createTransaction()).expect(401));

    it("(POST) should not create transaction with other user's key", async () => {
      const transaction = await createTransaction(admin, localnet2);

      const { status, body } = await endpoint.post(transaction, null, userAuthCookie);

      expect(status).toBe(400);
      expect(body).toMatchObject(
        expect.objectContaining({
          message: "Creator key doesn't belong to the user",
        }),
      );
    });

    it('(POST) should not create transaction with invalid network', async () => {
      const transaction = await createTransaction();
      transaction.network = 'some-network' as Network;

      const { status, body } = await endpoint.post(transaction, null, userAuthCookie);

      expect(status).toBe(400);
      expect(body).toMatchObject(
        expect.objectContaining({
          message: [
            'network must be one of the following values: mainnet, testnet, previewnet, local-node',
          ],
        }),
      );
    });

    it('(POST) should not create a transaction with invalid creator signature', async () => {
      const transaction = await createTransaction();
      transaction.signature = 'invalid-signature';

      const { status, body } = await endpoint.post(transaction, null, userAuthCookie);

      expect(status).toBe(400);
      expect(body).toMatchObject(
        expect.objectContaining({
          message: 'The signature does not match the public key',
        }),
      );
    });

    it('(POST) should not create a transaction without name, description, creatorKeyId, or network', async () => {
      const transaction = await createTransaction();
      delete transaction.name;
      delete transaction.description;
      delete transaction.creatorKeyId;
      delete transaction.network;

      const { status, body } = await endpoint.post(transaction, null, userAuthCookie);

      expect(status).toBe(400);
      expect(body).toMatchObject(
        expect.objectContaining({
          message: [
            'name must be a string',
            'description must be a string',
            'creatorKeyId must be a number conforming to the specified constraints',
            'network must be one of the following values: mainnet, testnet, previewnet, local-node',
            'network should not be empty',
          ],
        }),
      );
    });

    it('(POST) should not create a transaction with an invalid body', async () => {
      const { status } = await endpoint.post({ body: 'invalid' }, null, userAuthCookie);

      expect(status).toBe(400);
    });

    it('(POST) should not create a duplicating transaction', async () => {
      const transaction = await createTransaction();

      await endpoint.post(transaction, null, userAuthCookie);
      const { status, body } = await endpoint.post(transaction, null, userAuthCookie);

      expect(status).toBe(400);
      expect(body).toMatchObject(
        expect.objectContaining({
          message: 'Transaction already exists',
        }),
      );
    });

    it('(POST) should not create an expired transaction', async () => {
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

      const { status, body } = await endpoint.post(dto, null, userAuthCookie);

      expect(status).toBe(400);
      expect(body).toMatchObject(
        expect.objectContaining({
          message: 'Transaction is expired',
        }),
      );
    });
  });
});
