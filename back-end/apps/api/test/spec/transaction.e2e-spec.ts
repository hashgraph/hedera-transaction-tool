import { NestExpressApplication } from '@nestjs/platform-express';

import { Repository } from 'typeorm';
import {
  AccountCreateTransaction,
  AccountUpdateTransaction,
  Hbar,
  KeyList,
  PrivateKey,
  TransferTransaction,
} from '@hashgraph/sdk';

import {
  TransactionStatus,
  User,
  UserStatus,
  Transaction,
  TransactionType,
  UserKey,
  TransactionSigner,
  TransactionObserver,
} from '@entities';

import { closeApp, createNestApp, login, sleep } from '../utils';
import {
  addHederaLocalnetAccounts,
  addTransactions,
  createUser,
  getRepository,
  getUser,
  getUserKey,
  resetDatabase,
} from '../utils/databaseUtil';
import { Endpoint } from '../utils/httpUtils';
import {
  createAccount,
  createTransactionId,
  formatSignatureMap,
  getSignatureMapForPublicKeys,
  localnet1002,
  localnet1003,
  localnet2,
  updateAccount,
} from '../utils/hederaUtils';
import { HederaAccount } from '../utils/models';
import { ErrorCodes } from '@app/common';

describe('Transactions (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;

  let repo: Repository<Transaction>;

  let adminAuthToken: string;
  let userAuthToken: string;
  let userNewAuthToken: string;
  let admin: User;
  let user: User;
  let adminKey1002: UserKey;

  let addedTransactions: Awaited<ReturnType<typeof addTransactions>>;

  let testsAddedTransactionsCountUser = 0;
  let testsAddedTransactionsCountAdmin = 0;

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
      transactionBytes: buffer,
      creatorKeyId: userKey.id,
      signature: Buffer.from(
        (account || localnet1003).privateKey.sign(transaction.toBytes()),
      ).toString('hex'),
      mirrorNetwork: (account || localnet1003).mirrorNetwork,
    };
  };

  beforeAll(async () => {
    await resetDatabase();
    await addHederaLocalnetAccounts();
    addedTransactions = await addTransactions();

    repo = await getRepository(Transaction);

    app = await createNestApp();
    server = app.getHttpServer();

    adminAuthToken = await login(app, 'admin');
    userAuthToken = await login(app, 'user');
    userNewAuthToken = await login(app, 'userNew');

    admin = await getUser('admin');
    user = await getUser('user');

    adminKey1002 = await getUserKey(admin.id, localnet1002.publicKeyRaw);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  describe('/transactions', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/transactions');
    });

    it('(POST) should create a simple account create transaction', async () => {
      const transaction = await createTransaction();

      const { status, body } = await endpoint.post(transaction, null, userAuthToken);
      testsAddedTransactionsCountUser++;

      expect(status).toEqual(201);
      expect(body.transactionBytes).not.toEqual(transaction.transactionBytes);
      expect(body).toMatchObject(
        expect.objectContaining({
          name: transaction.name,
          description: transaction.description,
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          creatorKeyId: transaction.creatorKeyId,
        }),
      );
    });

    it('(POST) should create a transaction with an ID of a canceled transaction', async () => {
      const transaction = await createTransaction();

      const { body: newTransaction } = await endpoint.post(transaction, null, userAuthToken);
      testsAddedTransactionsCountUser++;

      const cancelEndpoint = new Endpoint(server, '/transactions/cancel');
      const cancelRes = await cancelEndpoint.patch(
        null,
        newTransaction.id.toString(),
        userAuthToken,
      );
      expect(cancelRes.status).toEqual(200);

      const { status, body } = await endpoint.post(transaction, null, userAuthToken);
      testsAddedTransactionsCountUser++;

      expect(status).toEqual(201);
      expect(body.transactionBytes).not.toEqual(transaction.transactionBytes);
      expect(body).toMatchObject(
        expect.objectContaining({
          name: transaction.name,
          description: transaction.description,
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          creatorKeyId: transaction.creatorKeyId,
        }),
      );
    });

    it.todo('(POST) should create a transaction with an ID of an archived transaction');

    it('(POST) should not create a transaction if user is not verified', async () => {
      const countBefore = await repo.count();
      await endpoint.post(await createTransaction(), null, userNewAuthToken).expect(403);
      const countAfter = await repo.count();

      expect(countAfter).toEqual(countBefore);
    });

    it('(POST) should not create a transaction if user has no keys', async () => {
      const countBefore = await repo.count();
      const transaction = await createTransaction();

      const user = await createUser('test@test.com', '1234567890', false, UserStatus.NONE);
      const token = await login(app, { ...user, password: '1234567890' });

      const { status, body } = await endpoint.post(transaction, null, token);
      const countAfter = await repo.count();

      expect(status).toEqual(401);
      expect(body).toMatchObject(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'You should have at least one key to perform this action.',
          statusCode: 401,
        }),
      );
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

      const { status, body } = await endpoint.post(transaction, null, userAuthToken);
      const countAfter = await repo.count();

      expect(status).toEqual(400);
      expect(body).toMatchObject(
        expect.objectContaining({
          code: ErrorCodes.PNY,
          message: 'The request is invalid. Please check the request body and try again.',
          statusCode: 400,
        }),
      );
      expect(countAfter).toEqual(countBefore);
    });

    it('(POST) should not create a transaction with invalid creator signature', async () => {
      const countBefore = await repo.count();
      const transaction = await createTransaction();
      transaction.signature = 'invalid-signature';

      const { status, body } = await endpoint.post(transaction, null, userAuthToken);
      const countAfter = await repo.count();

      expect(status).toEqual(400);
      expect(body).toMatchObject(
        expect.objectContaining({
          code: ErrorCodes.SNMP,
        }),
      );
      expect(countAfter).toEqual(countBefore);
    });

    it('(POST) should not create a transaction without name, description, creatorKeyId, or mirrorNetwork', async () => {
      const countBefore = await repo.count();
      const transaction = await createTransaction();

      delete transaction.name;
      delete transaction.description;
      delete transaction.creatorKeyId;
      delete transaction.mirrorNetwork;

      const { status, body } = await endpoint.post(transaction, null, userAuthToken);
      const countAfter = await repo.count();

      expect(status).toEqual(400);
      expect(body).toMatchObject(
        expect.objectContaining({
          code: ErrorCodes.IB,
        }),
      );
      expect(countAfter).toEqual(countBefore);
    });

    it('(POST) should not create a transaction with an invalid body', async () => {
      const countBefore = await repo.count();
      const { status } = await endpoint.post({ body: 'invalid' }, null, userAuthToken);
      const countAfter = await repo.count();

      expect(status).toEqual(400);
      expect(countAfter).toEqual(countBefore);
    });

    it('(POST) should not create a duplicating transaction', async () => {
      const transaction = await createTransaction();

      await endpoint.post(transaction, null, userAuthToken);

      const countBefore = await repo.count();
      const { status, body } = await endpoint.post(transaction, null, userAuthToken);
      const countAfter = await repo.count();

      testsAddedTransactionsCountUser++;

      expect(status).toEqual(400);
      expect(body).toMatchObject(
        expect.objectContaining({
          code: ErrorCodes.TEX,
        }),
      );
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
        transactionBytes: buffer,
        creatorKeyId: userKey.id,
        signature: Buffer.from(localnet1003.privateKey.sign(transaction.toBytes())).toString('hex'),
        mirrorNetwork: localnet1003.mirrorNetwork,
      };

      const { status, body } = await endpoint.post(dto, null, userAuthToken);
      const countAfter = await repo.count();

      expect(status).toEqual(400);
      expect(body).toMatchObject(
        expect.objectContaining({
          code: ErrorCodes.TE,
        }),
      );
      expect(countAfter).toEqual(countBefore);
    });

    it(
      '(POST) should not create a transaction that is oversized',
      async () => {
        const countBefore = await repo.count();

        const keylist = new KeyList();
        for (let i = 0; i < 180; i++) {
          keylist.push(PrivateKey.generate().publicKey);
        }
        const transaction = new AccountCreateTransaction()
          .setTransactionId(createTransactionId(localnet1003.accountId, new Date()))
          .setKey(keylist);

        const buffer = Buffer.from(transaction.toBytes()).toString('hex');

        const userKey = await getUserKey(user.id, localnet1003.publicKeyRaw);

        if (userKey === null) throw new Error('User key not found');

        const dto = {
          name: 'Oversized Account Create Transaction',
          description: 'This is a oversized account create transaction',
          transactionBytes: buffer,
          creatorKeyId: userKey.id,
          signature: Buffer.from(localnet1003.privateKey.sign(transaction.toBytes())).toString(
            'hex',
          ),
          mirrorNetwork: localnet1003.mirrorNetwork,
        };

        const { status, body } = await endpoint.post(dto, null, userAuthToken);
        const countAfter = await repo.count();

        expect(status).toEqual(400);
        expect(body).toMatchObject(
          expect.objectContaining({
            code: ErrorCodes.TOS,
          }),
        );
        expect(countAfter).toEqual(countBefore);
      },
      30 * 1_000,
    );

    it('(GET) should get all transactions for user', async () => {
      const { status, body } = await endpoint.get(null, userAuthToken, 'page=1&size=99');

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(
        addedTransactions.userTransactions.length + testsAddedTransactionsCountUser,
      );
    });

    it('(GET) should get all transactions for admin', async () => {
      const { status, body } = await endpoint.get(null, adminAuthToken, 'page=1&size=99');

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(addedTransactions.adminTransactions.length);
    });

    it('(GET) should get all file create transactions', async () => {
      const { status, body } = await endpoint.get(
        null,
        userAuthToken,
        `page=1&size=99&filter=type:eq:${TransactionType.FILE_CREATE}`,
      );
      const { status: status2, body: body2 } = await endpoint.get(
        null,
        adminAuthToken,
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
      const { status, body } = await endpoint.get(null, userAuthToken, 'page=1&size=2');

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
      TransactionStatus.ARCHIVED,
    ];
    const forbiddenStatuses = Object.values(TransactionStatus).filter(
      s => !allowedStatuses.includes(s),
    );

    const getRandomStatus = () =>
      allowedStatuses[Math.floor(Math.random() * allowedStatuses.length)];

    beforeAll(async () => {
      endpoint = new Endpoint(server, '/transactions/history');

      await resetDatabase();
      await addHederaLocalnetAccounts();
      testsAddedTransactionsCountUser = 0;
      testsAddedTransactionsCountAdmin = 0;
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
      testsAddedTransactionsCountUser = 0;
      testsAddedTransactionsCountAdmin = 0;
      addedTransactions = await addTransactions();
    });

    it('(GET) should get all transactions that are visible to everyone', async () => {
      const { status, body } = await endpoint.get(null, userAuthToken, 'page=1&size=99');

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(addedTransactions.total);
    });

    it('(GET) should get all transactions that are visible to everyone with filtering', async () => {
      const { status, body } = await endpoint.get(
        null,
        userAuthToken,
        `page=1&size=99&filter=status:eq:${TransactionStatus.EXECUTED}`,
      );
      const actualExpired = addedTransactions.userTransactions
        .concat(addedTransactions.adminTransactions)
        .filter(t => t.status === TransactionStatus.EXECUTED);

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(actualExpired.length);
    });

    it('(GET) should not get transactions if not verified', async () => {
      await endpoint.get(null, userNewAuthToken, 'page=1&size=99').expect(403);
    });

    it('(GET) should get paginated transactions', async () => {
      const { status, body } = await endpoint.get(null, userAuthToken, 'page=1&size=2');

      expect(status).toEqual(200);
      expect(body.items.length).toEqual(2);
    });

    it('(GET) should not get transactions if not logged in', async () => {
      await endpoint.get(null, null).expect(401);
    });

    it('(GET) should not get forbidden transactions', async () => {
      const { status, body } = await endpoint.get(
        null,
        userAuthToken,
        `page=1&size=99&filter=status:in:${forbiddenStatuses.join(', ')}`,
      );

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(0);
    });
  });

  describe('/transactions/sign', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/transactions/sign');
    });

    it('(GET) should get all transactions to sign', async () => {
      /* User has created 3 transactions that need his signatures */
      const { status, body } = await endpoint.get(null, userAuthToken, 'page=1&size=99');

      /* Admin has created 1 transaction that needs his signature, but one of the user created transaction requires admin's key signature */
      const { status: status2, body: body2 } = await endpoint.get(
        null,
        adminAuthToken,
        'page=1&size=99',
      );

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(3);

      expect(status2).toEqual(200);
      expect(body2.totalItems).toEqual(2);
    });

    it('(GET) should get paginated transactions', async () => {
      const { status, body } = await endpoint.get(null, userAuthToken, 'page=1&size=2');

      expect(status).toEqual(200);
      expect(body.items.length).toEqual(2);
    });

    it('(GET) should not get transactions to sign if not verified', async () => {
      await endpoint.get(null, userNewAuthToken, 'page=1&size=99').expect(403);
    });

    it('(GET) should not get transactions to sign if not logged in', async () => {
      await endpoint.get(null, null).expect(401);
    });

    it('(GET) should not get transactions to sign if user has no keys', async () => {
      const user = await createUser('test123@test.com', '1234567890', false, UserStatus.NONE);
      const token = await login(app, { ...user, password: '1234567890' });

      const { body } = await endpoint.get(null, token, 'page=1&size=99');

      expect(body.totalItems).toEqual(0);
    });

    let newlyCreatedAccount: HederaAccount;

    it('(GET) should get transaction to sign if user key is included in the transaction', async () => {
      const { accountId } = await createAccount(
        localnet2.accountId,
        localnet2.privateKey,
        localnet2.publicKey,
      );

      newlyCreatedAccount = new HederaAccount()
        .setAccountId(accountId.toString())
        .setPrivateKey(localnet2.privateKey.toStringDer())
        .setNetwork(localnet2.mirrorNetwork);

      await sleep(3000); //Wait for mirror node to update its data after account creation

      const transaction = new AccountUpdateTransaction()
        .setTransactionId(createTransactionId(localnet2.accountId))
        .setAccountId(accountId)
        .setKey(localnet1003.publicKey);
      const buffer = Buffer.from(transaction.toBytes()).toString('hex');
      const userKey = await getUserKey(admin.id, localnet2.publicKeyRaw);
      if (userKey === null) throw new Error('TEST: User key not found');

      const dto = {
        name: 'In Test #1 Account Update Transaction',
        description: 'TEST This is a account update transaction',
        transactionBytes: buffer,
        creatorKeyId: userKey.id,
        signature: Buffer.from(localnet2.privateKey.sign(transaction.toBytes())).toString('hex'),
        mirrorNetwork: localnet2.mirrorNetwork,
      };

      await new Endpoint(server, '/transactions').post(dto, null, adminAuthToken).expect(201);
      testsAddedTransactionsCountAdmin++;
      testsAddedTransactionsCountUser++;

      const { status, body } = await endpoint.get(null, userAuthToken, 'page=1&size=99');

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(
        addedTransactions.userToSignCount + testsAddedTransactionsCountUser,
      );
    });

    it('(GET) should get transaction to sign if user has a key with an account that is payer for transaction', async () => {
      const transaction = new AccountCreateTransaction()
        .setTransactionId(createTransactionId(localnet2.accountId))
        .setKey(localnet1003.publicKey);
      const buffer = Buffer.from(transaction.toBytes()).toString('hex');
      const userKey = await getUserKey(user.id, localnet1003.publicKeyRaw);
      if (userKey === null) throw new Error('TEST: User key not found');

      const dto = {
        name: 'In Test #2 Simple Account Create Transaction',
        description: 'TEST This is a simple account create transaction',
        transactionBytes: buffer,
        creatorKeyId: userKey.id,
        signature: Buffer.from(localnet1003.privateKey.sign(transaction.toBytes())).toString('hex'),
        mirrorNetwork: localnet2.mirrorNetwork,
      };

      await new Endpoint(server, '/transactions').post(dto, null, userAuthToken).expect(201);
      testsAddedTransactionsCountAdmin++;

      const { status, body } = await endpoint.get(null, adminAuthToken, 'page=1&size=99');

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(
        addedTransactions.adminToSignCount + testsAddedTransactionsCountAdmin,
      );
    });

    it('(GET) should get transaction to sign if a user has a key with an account that requires a signature upon receiving Hbars and this account is added as a receiver in a transaction', async () => {
      await updateAccount(
        localnet2.accountId,
        localnet2.privateKey,
        newlyCreatedAccount.accountId,
        newlyCreatedAccount.privateKey,
        {
          newKey: localnet1003.publicKey,
          newKeyPrivateKey: localnet1003.privateKey,
          receiverSignatureRequired: true,
        },
      );

      await sleep(3000); //Wait for mirror node to update its data after account creation

      const transaction = new TransferTransaction()
        .setTransactionId(createTransactionId(localnet2.accountId))
        .addHbarTransfer(newlyCreatedAccount.accountId, Hbar.fromString('10'));
      const buffer = Buffer.from(transaction.toBytes()).toString('hex');
      const userKey = await getUserKey(admin.id, localnet2.publicKeyRaw);
      if (userKey === null) throw new Error('TEST: User key not found');

      const dto = {
        name: 'In Test #3 TEST Transfer Transaction',
        description: 'TEST This is a transfer transaction',
        transactionBytes: buffer,
        creatorKeyId: userKey.id,
        signature: Buffer.from(localnet2.privateKey.sign(transaction.toBytes())).toString('hex'),
        mirrorNetwork: localnet2.mirrorNetwork,
      };

      await new Endpoint(server, '/transactions').post(dto, null, adminAuthToken).expect(201);
      testsAddedTransactionsCountAdmin++;
      testsAddedTransactionsCountUser++;

      const { status, body } = await endpoint.get(null, userAuthToken, 'page=1&size=99');

      expect(status).toEqual(200);
      expect(body.totalItems).toEqual(
        addedTransactions.userToSignCount + testsAddedTransactionsCountUser,
      );
    });
  });

  describe('/transactions/sign/:transactionId', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/transactions/sign');
    });

    it('(GET) should get keys required to sign for the given transaction', async () => {
      const { status, body } = await endpoint.get('1', userAuthToken);
      const userKey1003 = await getUserKey(user.id, localnet1003.publicKeyRaw);

      expect(status).toEqual(200);
      expect(body).toEqual([userKey1003.id]);
    });

    it('(GET) should not get transactions to sign if not verified', () =>
      endpoint.get('1', userNewAuthToken).expect(403));

    it('(GET) should not get transactions to sign if not logged in', () =>
      endpoint.get('1', null).expect(401));

    it('(GET) should get empty array if user should not sign the transaction', () =>
      endpoint.get('4', userAuthToken).expect(200).expect([]));

    it('(GET) should get empty array if transaction does not exist', async () =>
      endpoint.get('999', userAuthToken).expect(200).expect([]));

    it('(GET) should get empty array if the transaction is already signed', async () => {
      const transactionsEndpoint = new Endpoint(server, '/transactions');

      /* A transaction created by user that requires the admin to sign */
      const transaction = addedTransactions.userTransactions[1];

      const beforeSignRes = await endpoint.get(transaction.id.toString(), adminAuthToken);
      expect(beforeSignRes.status).toBe(200);
      expect(beforeSignRes.body).toEqual([adminKey1002.id]);

      /* Sign transaction (ADMIN) */
      const sdkTransaction = AccountUpdateTransaction.fromBytes(transaction.transactionBytes);
      await sdkTransaction.sign(localnet1002.privateKey);
      const signatureMap = getSignatureMapForPublicKeys(
        [localnet1002.publicKeyRaw],
        sdkTransaction,
      );

      await transactionsEndpoint
        .post(
          {
            signatureMap: formatSignatureMap(signatureMap),
          },
          `/${transaction.id}/signers`,
          adminAuthToken,
        )
        .expect(201);

      /* Get observers (ADMIN) */
      const afterSignRes = await endpoint.get(transaction.id.toString(), adminAuthToken);
      expect(afterSignRes.status).toBe(200);
      expect(afterSignRes.body).toEqual([]);

      /* Delete the signer entity */
      const signersRepo = await getRepository(TransactionSigner);
      await signersRepo.delete({ transactionId: transaction.id });

      expect(await signersRepo.count({ where: { transactionId: transaction.id } })).toBe(0);
    });
  });

  describe('/transactions/cancel/:transactionId', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/transactions/cancel');
    });

    afterAll(async () => {
      await resetDatabase();
      await addHederaLocalnetAccounts();
      testsAddedTransactionsCountUser = 0;
      testsAddedTransactionsCountAdmin = 0;
      addedTransactions = await addTransactions();
    });

    it('(PATCH) should cancel a transaction if creator', async () => {
      const transaction = await createTransaction(user, localnet1003);
      const { body: newTransaction } = await new Endpoint(server, '/transactions')
        .post(transaction, null, userAuthToken)
        .expect(201);

      const { status } = await endpoint.patch(null, newTransaction.id.toString(), userAuthToken);

      const transactionFromDb = await repo.findOne({ where: { id: newTransaction.id } });

      expect(status).toEqual(200);
      expect(transactionFromDb?.status).toEqual(TransactionStatus.CANCELED);
    });

    it('(PATCH) should not cancel a transaction if not creator', async () => {
      const transaction = await createTransaction(user, localnet1003);
      const { body: newTransaction } = await new Endpoint(server, '/transactions')
        .post(transaction, null, userAuthToken)
        .expect(201);

      const { status } = await endpoint.patch(null, newTransaction.id.toString(), adminAuthToken);

      const transactionFromDb = await repo.findOne({ where: { id: newTransaction.id } });

      expect(status).toEqual(401);
      expect(transactionFromDb?.status).not.toEqual(TransactionStatus.CANCELED);
    });

    it('(PATCH) should not cancel a transaction if not verified', async () => {
      const transaction = await createTransaction(user, localnet1003);
      const { body: newTransaction } = await new Endpoint(server, '/transactions')
        .post(transaction, null, userAuthToken)
        .expect(201);

      const { status } = await endpoint.patch(null, newTransaction.id.toString(), userNewAuthToken);

      const transactionFromDb = await repo.findOne({ where: { id: newTransaction.id } });

      expect(status).toEqual(403);
      expect(transactionFromDb?.status).not.toEqual(TransactionStatus.CANCELED);
    });

    it("(PATCH) should not cancel a transaction if it's already executed", async () => {
      const transaction = await createTransaction(user, localnet1003);
      const { body: newTransaction } = await new Endpoint(server, '/transactions')
        .post(transaction, null, userAuthToken)
        .expect(201);

      await repo.update({ id: newTransaction.id }, { status: TransactionStatus.EXECUTED });

      const { status } = await endpoint.patch(null, newTransaction.id.toString(), userAuthToken);

      const transactionFromDb = await repo.findOne({ where: { id: newTransaction.id } });

      expect(status).toEqual(400);
      expect(transactionFromDb?.status).not.toEqual(TransactionStatus.CANCELED);
    });
  });

  describe('/transactions/archive/:transactionId', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/transactions/cancel');
    });

    afterAll(async () => {
      await resetDatabase();
      await addHederaLocalnetAccounts();
      testsAddedTransactionsCountUser = 0;
      testsAddedTransactionsCountAdmin = 0;
      addedTransactions = await addTransactions();
    });

    it.todo('(PATCH) should archive a transaction if creator');
    it.todo('(PATCH) should not archive a transaction if not creator');
    it.todo('(PATCH) should not archive a transaction if not verified');
    it.todo("(PATCH) should not archive a transaction if it's already executed");
  });

  describe('/transactions/:transactionId', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/transactions');
    });

    afterAll(async () => {
      await resetDatabase();
      await addHederaLocalnetAccounts();
      testsAddedTransactionsCountUser = 0;
      testsAddedTransactionsCountAdmin = 0;
      addedTransactions = await addTransactions();
    });

    it('(GET) should get a transaction by id if has access (Is creator)', async () => {
      const id = addedTransactions.userTransactions[0].id;

      const { status, body } = await endpoint.get(id.toString(), userAuthToken);

      expect(status).toEqual(200);
      expect(body.id).toEqual(id);
    });

    it('(GET) should get a transaction by id if has access (is observer)', async () => {
      /* A transaction created by user that requires the admin to sign */
      const transaction = addedTransactions.userTransactions[0];

      /* Add user as observer (USER) */
      await endpoint
        .post(
          {
            userIds: [admin.id],
          },
          `/${transaction.id}/observers`,
          userAuthToken,
        )
        .expect(201);

      /* Get observers (ADMIN) */
      const { status, body } = await endpoint.get(transaction.id.toString(), adminAuthToken);

      expect(status).toBe(200);
      expect(body.id).toEqual(transaction.id);

      /* Delete the signer entity */
      const observersRepo = await getRepository(TransactionObserver);
      await observersRepo.delete({ transactionId: transaction.id });

      expect(await observersRepo.count({ where: { transactionId: transaction.id } })).toBe(0);
    });

    it('(GET) should get a transaction by id if has access (is signer)', async () => {
      /* A transaction created by user that requires the admin to sign */
      const transaction = addedTransactions.userTransactions[1];

      /* Sign transaction (ADMIN) */
      const sdkTransaction = AccountUpdateTransaction.fromBytes(transaction.transactionBytes);
      await sdkTransaction.sign(localnet1002.privateKey);
      const signatureMap = getSignatureMapForPublicKeys(
        [localnet1002.publicKeyRaw],
        sdkTransaction,
      );

      await endpoint
        .post(
          {
            signatureMap: formatSignatureMap(signatureMap),
          },
          `/${transaction.id}/signers`,
          adminAuthToken,
        )
        .expect(201);

      /* Get observers (ADMIN) */
      const { status, body } = await endpoint.get(transaction.id.toString(), adminAuthToken);

      expect(status).toBe(200);
      expect(body.id).toEqual(transaction.id);

      /* Delete the signer entity */
      const signersRepo = await getRepository(TransactionSigner);
      await signersRepo.delete({ transactionId: transaction.id });

      expect(await signersRepo.count({ where: { transactionId: transaction.id } })).toBe(0);
    });

    it('(GET) should get a transaction by id if has access (should sign)', async () => {
      const transaction = addedTransactions.userTransactions[1];

      const { status, body } = await endpoint.get(transaction.id.toString(), adminAuthToken);

      expect(status).toBe(200);
      expect(body.id).toEqual(transaction.id);
    });

    it('(GET) should get a transaction by id if has access (is in a status visible for everyone)', async () => {
      const transaction = await createTransaction(user, localnet1003);
      const { body: newTransaction } = await new Endpoint(server, '/transactions')
        .post(transaction, null, userAuthToken)
        .expect(201);
      await repo.update({ id: newTransaction.id }, { status: TransactionStatus.EXECUTED });

      const { status, body } = await endpoint.get(newTransaction.id.toString(), adminAuthToken);

      expect(status).toEqual(200);
      expect(body.id).toEqual(newTransaction.id);
    });

    it('(GET) should NOT get a transaction by id if has access (is in a status NOT visible for everyone)', async () => {
      const transaction = await createTransaction(user, localnet1003);
      const { body: newTransaction } = await new Endpoint(server, '/transactions')
        .post(transaction, null, userAuthToken)
        .expect(201);

      return endpoint.get(newTransaction.id.toString(), adminAuthToken).expect(401);
    });

    it('(GET) should not get a transaction by id if not creator, signer, observer, reviewer or should sign', () =>
      endpoint
        .get(addedTransactions.userTransactions[0].id.toString(), adminAuthToken)
        .expect(401));

    it('(GET) should not get a transaction by id if not verified', () =>
      endpoint
        .get(addedTransactions.userTransactions[0].id.toString(), userNewAuthToken)
        .expect(403));
  });
});
