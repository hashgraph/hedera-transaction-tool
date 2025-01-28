import { NestExpressApplication } from '@nestjs/platform-express';

import { Repository } from 'typeorm';
import {
  AccountCreateTransaction,
  AccountUpdateTransaction,
  KeyList,
  SignatureMap,
  Transaction as SDKTransaction,
} from '@hashgraph/sdk';

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
  formatSignatureMap,
  getSignatureMapForPublicKeys,
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

    it('(POST) should upload a signature map for a transaction', async () => {
      const transaction = addedTransactions.userTransactions[0];
      const sdkTransaction = AccountCreateTransaction.fromBytes(transaction.transactionBytes);
      await sdkTransaction.sign(localnet1003.privateKey);
      const signatureMap = getSignatureMapForPublicKeys(
        [localnet1003.publicKeyRaw],
        sdkTransaction,
      );

      const response = await endpoint.post(
        {
          signatureMap: formatSignatureMap(signatureMap),
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
      expect(response.body).toEqual([
        expect.objectContaining({
          id: transaction.id,
        }),
      ]);
    });

    it('(POST) should upload a signature map 2 public keys for a transaction', async () => {
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

      const frozenSdkTransaction = AccountUpdateTransaction.fromBytes(
        Buffer.from(createTxResponse.body.transactionBytes, 'hex'),
      );
      await frozenSdkTransaction.sign(localnet1003.privateKey);
      await frozenSdkTransaction.sign(localnet1004.privateKey);
      const signatureMap = getSignatureMapForPublicKeys(
        [localnet1003.publicKeyRaw, localnet1004.publicKeyRaw],
        frozenSdkTransaction,
      );

      const { status, body } = await endpoint.post(
        {
          signatureMap: formatSignatureMap(signatureMap),
        },
        `${createTxResponse.body.id}/signers`,
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

    it('(POST) should NOT upload a signature for a transaction with a key that does not belong to the user', async () => {
      const transaction = addedTransactions.userTransactions[0];
      const sdkTransaction = AccountCreateTransaction.fromBytes(transaction.transactionBytes);
      await sdkTransaction.sign(localnet1002.privateKey);
      const signatureMap = getSignatureMapForPublicKeys(
        [localnet1002.publicKeyRaw],
        sdkTransaction,
      );

      const { status, body } = await endpoint.post(
        {
          signatureMap: formatSignatureMap(signatureMap),
        },
        `/${transaction.id}/signers`,
        userAuthToken,
      );

      expect(status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.PNY,
        }),
      );
    });

    it('(POST) should NOT upload a signature for a transaction that does not exist', async () => {
      const { status, body } = await endpoint.post(
        {
          signatureMap: formatSignatureMap(new SignatureMap()),
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

    describe('(POST) transaction status checks', () => {
      let transaction: Transaction;
      let signatureMap: SignatureMap;
      let sdkTransaction: SDKTransaction;

      beforeAll(async () => {
        transaction = addedTransactions.userTransactions[0];
        sdkTransaction = AccountCreateTransaction.fromBytes(transaction.transactionBytes);
        await sdkTransaction.sign(localnet1003.privateKey);
        signatureMap = getSignatureMapForPublicKeys([localnet1003.publicKeyRaw], sdkTransaction);
      });

      it('(POST) should NOT upload a signature for a transaction that has been canceled', async () => {
        await transactionRepo.update(
          { id: transaction.id },
          { status: TransactionStatus.CANCELED },
        );

        const { status, body } = await endpoint.post(
          { signatureMap: formatSignatureMap(signatureMap) },
          `/${transaction.id}/signers`,
          userAuthToken,
        );

        expect(status).toBe(400);
        expect(body).toEqual(
          expect.objectContaining({
            statusCode: 400,
            code: ErrorCodes.TNRS,
          }),
        );
      });

      it('(POST) should NOT upload a signature for a transaction that has been archived', async () => {
        await transactionRepo.update(
          { id: transaction.id },
          { status: TransactionStatus.ARCHIVED },
        );

        const { status, body } = await endpoint.post(
          { signatureMap: formatSignatureMap(signatureMap) },
          `/${transaction.id}/signers`,
          userAuthToken,
        );

        expect(status).toBe(400);
        expect(body).toEqual(
          expect.objectContaining({
            statusCode: 400,
            code: ErrorCodes.TNRS,
          }),
        );
      });
    });

    it('(POST) should NOT upload invalid body', async () => {
      const transaction = addedTransactions.userTransactions[0];
      const signatureMap = {
        asd: 'invalid-signature',
      };

      const { status, body } = await endpoint.post(
        {
          signatureMap,
        },
        `/${transaction.id}/signers`,
        userAuthToken,
      );

      expect(status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.ISNMP,
        }),
      );
    });

    it('(POST) should NOT upload a signature that is invalid', async () => {
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

      const frozenSdkTransaction = AccountUpdateTransaction.fromBytes(
        Buffer.from(createTxResponse.body.transactionBytes, 'hex'),
      );
      await frozenSdkTransaction.sign(localnet1003.privateKey);
      const signatureMap = getSignatureMapForPublicKeys(
        [localnet1003.publicKeyRaw],
        frozenSdkTransaction,
      );
      const formattedSignatureMap = formatSignatureMap(signatureMap);

      const nodeAccountIds = Object.keys(formattedSignatureMap);
      const transactionIds = Object.keys(formattedSignatureMap[nodeAccountIds[0]]);
      const publicKeys = Object.keys(formattedSignatureMap[nodeAccountIds[0]][transactionIds[0]]);
      formattedSignatureMap[nodeAccountIds[0]][transactionIds[0]][publicKeys[0]] =
        'invalid-signature';

      const { status, body } = await endpoint.post(
        {
          signatureMap: formattedSignatureMap,
        },
        `${createTxResponse.body.id}/signers`,
        userAuthToken,
      );

      expect(status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.ISNMP,
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
