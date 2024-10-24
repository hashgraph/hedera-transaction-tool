import { NestExpressApplication } from '@nestjs/platform-express';

import { Repository } from 'typeorm';
import { AccountCreateTransaction, AccountUpdateTransaction, KeyList } from '@hashgraph/sdk';

import { ErrorCodes } from '@app/common';
import { User, Transaction, TransactionSigner, UserKey, TransactionStatus } from '@entities';

import { closeApp, createNestApp, login } from '../utils';
import {
  addHederaLocalnetAccounts,
  addTransactions,
  getRepository,
  getUser,
  getUserKey,
  resetDatabase,
} from '../utils/databaseUtil';
import { Endpoint } from '../utils/httpUtils';
import {
  createTransactionId,
  getSignatures,
  localnet1002,
  localnet1003,
  localnet1004,
} from '../utils/hederaUtils';

describe('Transactions (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;

  let transactionRepo: Repository<Transaction>;
  let transactionSignerRepo: Repository<TransactionSigner>;

  let adminAuthToken: string;
  let userAuthToken: string;
  let admin: User;
  let user: User;
  let userKey1003: UserKey;

  let addedTransactions: Awaited<ReturnType<typeof addTransactions>>;

  beforeAll(async () => {
    await resetDatabase();
    await addHederaLocalnetAccounts();
    addedTransactions = await addTransactions();

    transactionRepo = await getRepository(Transaction);
    transactionSignerRepo = await getRepository(TransactionSigner);

    app = await createNestApp();
    server = app.getHttpServer();

    adminAuthToken = await login(app, 'admin');
    userAuthToken = await login(app, 'user');

    admin = await getUser('admin');
    user = await getUser('user');
    userKey1003 = await getUserKey(user.id, localnet1003.publicKeyRaw);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  describe('/transactions/:transactionId/signers', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/transactions');
    });

    it('(POST) should upload a signature for a transaction when required to sign', async () => {
      const transaction = addedTransactions.userTransactions[0];
      const sdkTransaction = AccountCreateTransaction.fromBytes(transaction.transactionBytes);
      const signatures = getSignatures(localnet1003.privateKey, sdkTransaction);

      const response = await endpoint.post(
        {
          publicKeyId: userKey1003.id,
          signatures,
        },
        `/${transaction.id}/signers`,
        userAuthToken,
      );

      const signerEntry = await transactionSignerRepo.findOne({
        where: {
          transactionId: transaction.id,
          userKeyId: userKey1003.id,
        },
      });

      expect(signerEntry).toBeDefined();
      expect(response.status).toBe(201);
      expect(response.body).toEqual(
        expect.objectContaining({
          id: transaction.id,
        }),
      );
    });

    it('(POST) should NOT upload a signature for a transaction when not required to sign', async () => {
      const transaction = addedTransactions.userTransactions[0];
      const sdkTransaction = AccountCreateTransaction.fromBytes(transaction.transactionBytes);
      const userKey1002 = await getUserKey(admin.id, localnet1002.publicKeyRaw);
      const signatures = getSignatures(localnet1002.privateKey, sdkTransaction);

      const response = await endpoint.post(
        {
          publicKeyId: userKey1002.id,
          signatures,
        },
        `/${transaction.id}/signers`,
        adminAuthToken,
      );

      const signerEntry = await transactionSignerRepo.findOne({
        where: {
          transactionId: transaction.id,
          userKeyId: userKey1002.id,
        },
      });

      expect(signerEntry).toBeNull();
      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.KNRS,
        }),
      );
    });

    it('(POST) should NOT upload a signature for a transaction when already signed', async () => {
      const transaction = addedTransactions.userTransactions[0];
      const sdkTransaction = AccountCreateTransaction.fromBytes(transaction.transactionBytes);
      const signatures = getSignatures(localnet1003.privateKey, sdkTransaction);

      /* User has already signed in a previous test */
      const response = await endpoint.post(
        {
          publicKeyId: userKey1003.id,
          signatures,
        },
        `/${transaction.id}/signers`,
        userAuthToken,
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.SAD,
        }),
      );
    });

    it('(POST) should NOT upload a signature for a transaction with a key that does not belong to the user', async () => {
      const transaction = addedTransactions.userTransactions[0];
      const sdkTransaction = AccountCreateTransaction.fromBytes(transaction.transactionBytes);
      const userKey1002 = await getUserKey(admin.id, localnet1002.publicKeyRaw);
      const signatures = getSignatures(localnet1003.privateKey, sdkTransaction);

      const { status, body } = await endpoint.post(
        {
          publicKeyId: userKey1002.id,
          signatures,
        },
        `/${transaction.id}/signers`,
        userAuthToken,
      );

      expect(status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          // message: 'Transaction can be signed only with your own key',
        }),
      );
    });

    it('(POST) should NOT upload a signature for a transaction that does not exist', async () => {
      const { status, body } = await endpoint.post(
        {
          publicKeyId: userKey1003.id,
          signatures: [],
        },
        '/123/signers',
        userAuthToken,
      );

      expect(status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.TNF,
        }),
      );
    });

    it('(POST) should NOT upload a signature for a transaction that has been canceled', async () => {
      const transaction = addedTransactions.userTransactions[0];
      await transactionRepo.update(
        { id: transaction.id },
        {
          status: TransactionStatus.CANCELED,
        },
      );
      const signatures = getSignatures(
        localnet1003.privateKey,
        AccountCreateTransaction.fromBytes(transaction.transactionBytes),
      );

      const { status, body } = await endpoint.post(
        {
          publicKeyId: userKey1003.id,
          signatures,
        },
        `/${transaction.id}/signers`,
        userAuthToken,
      );

      expect(status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.TC,
        }),
      );
    });

    it('(POST) should NOT upload a signature that is invalid', async () => {
      const transaction = addedTransactions.userTransactions[0];
      const signatures = ['invalid-signature'];

      const { status, body } = await endpoint.post(
        {
          publicKeyId: userKey1003.id,
          signatures,
        },
        `/${transaction.id}/signers`,
        userAuthToken,
      );

      expect(status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          // message: 'Invalid signature',
        }),
      );
    });

    it('(GET) should return all signatures for a transaction', async () => {
      const transaction = addedTransactions.userTransactions[0];

      const { status, body } = await endpoint.get(`${transaction.id}/signers`, userAuthToken);

      expect(status).toBe(200);
      expect(body.length).toBeGreaterThan(0);

      expect(body[0]).toEqual(
        expect.objectContaining({
          userKey: expect.objectContaining({
            id: userKey1003.id,
          }),
        }),
      );
    });

    it('(GET) should return all signatures for a transaction requested by a user that is not part of the transaction', async () => {
      const transaction = addedTransactions.userTransactions[0];

      const { status, body } = await endpoint.get(`${transaction.id}/signers`, adminAuthToken);

      expect(status).toBe(200);
      expect(body.length).toBeGreaterThan(0);

      expect(body[0]).toEqual(
        expect.objectContaining({
          userKey: expect.objectContaining({
            id: userKey1003.id,
          }),
        }),
      );
    });
  });

  describe('/transactions/:transactionId/signers/many', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/transactions');
    });

    it('(POST) should upload multiple signatures for a transaction when required to sign', async () => {
      const sdkTransaction = new AccountUpdateTransaction()
        .setTransactionId(createTransactionId(localnet1003.accountId))
        .setKey(new KeyList([localnet1003.publicKey, localnet1004.privateKey]));
      const buffer = Buffer.from(sdkTransaction.toBytes()).toString('hex');

      const userKey1004 = await getUserKey(user.id, localnet1004.publicKeyRaw);

      if (userKey1004 === null) {
        throw new Error('User key not found');
      }

      const transactionBody = {
        name: 'TEST Simple Account Create Transaction',
        description: 'TEST This is a simple account create transaction',
        transactionBytes: buffer,
        creatorKeyId: userKey1003.id,
        signature: Buffer.from(localnet1003.privateKey.sign(sdkTransaction.toBytes())).toString(
          'hex',
        ),
        mirrorNetwork: localnet1003.mirrorNetwork,
      };

      const createTxResponse = await endpoint.post(transactionBody, '', userAuthToken);
      expect(createTxResponse.status).toBe(201);

      const signatures1 = getSignatures(localnet1003.privateKey, sdkTransaction);
      const signatures2 = getSignatures(localnet1004.privateKey, sdkTransaction);

      const { status, body } = await endpoint.post(
        {
          signatures: [
            {
              publicKeyId: userKey1003.id,
              signatures: signatures1,
            },
            {
              publicKeyId: userKey1004.id,
              signatures: signatures2,
            },
          ],
        },
        `${createTxResponse.body.id}/signers/many`,
        userAuthToken,
      );

      const signer1Entry = await transactionSignerRepo.findOne({
        where: {
          transactionId: createTxResponse.body.id,
          userKeyId: userKey1003.id,
        },
      });
      const signer2Entry = await transactionSignerRepo.findOne({
        where: {
          transactionId: createTxResponse.body.id,
          userKeyId: userKey1004.id,
        },
      });

      expect(signer1Entry).toBeDefined();
      expect(signer2Entry).toBeDefined();
      expect(status).toBe(201);
      expect(body.length).toBe(2);
    });
  });

  describe('/transactions/:transactionId/signers/user', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/transactions');
    });

    it('(GET) should return all signatures for a transaction requested by a user', async () => {
      const transaction = addedTransactions.userTransactions[0];

      const { status, body } = await endpoint.get(
        `${transaction.id}/signers/user`,
        userAuthToken,
        'page=1&size=10',
      );

      expect(status).toBe(200);
      expect(body.items.length).toBeGreaterThan(0);

      expect(body.items[0]).toEqual(
        expect.objectContaining({
          userKeyId: userKey1003.id,
        }),
      );
    });

    it('(GET) should return all signatures for a transaction requested by a user that is not part of the transaction', async () => {
      const transaction = addedTransactions.userTransactions[0];

      const { status, body } = await endpoint.get(
        `${transaction.id}/signers/user`,
        adminAuthToken,
        'page=1&size=10',
      );

      expect(status).toBe(200);
      expect(body.items.length).toEqual(0);
    });
  });
});
