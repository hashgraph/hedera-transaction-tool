import { NestExpressApplication } from '@nestjs/platform-express';

import { Repository } from 'typeorm';
import { AccountCreateTransaction, Client, PrivateKey } from '@hiero-ledger/sdk';

import { ErrorCodes } from '@app/common';
import {
  Transaction,
  TransactionReviewerListMember,
  TransactionStatus,
  User,
  UserKey,
} from '@entities';

import { buildReviewAttestationMessage } from '../../src/transactions/reviewers/reviewers.service';

import { closeApp, createNestApp, login } from '../utils';
import {
  addHederaLocalnetAccounts,
  addReviewerList,
  addTransactions,
  attachKeyToUser,
  getRepository,
  getUser,
  getUserKey,
  resetDatabase,
} from '../utils/databaseUtil';
import { Endpoint } from '../utils/httpUtils';
import { createTransactionId, getTransactionTypeEnumValue, localnet1002 } from '../utils/hederaUtils';
import { HederaAccount } from '../utils/models';

describe('Transaction Reviewers (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;
  let endpoint: Endpoint;

  let transactionRepo: Repository<Transaction>;
  let reviewerListMemberRepo: Repository<TransactionReviewerListMember>;

  let adminAuthToken: string;
  let userAuthToken: string;
  let admin: User;
  let user: User;
  let adminKey1002: UserKey;

  let reviewerKeyA: PrivateKey;
  let reviewerKeyB: PrivateKey;
  let reviewerUserKeyA: UserKey;
  let reviewerUserKeyB: UserKey;

  let addedTransactions: Awaited<ReturnType<typeof addTransactions>>;

  const createReadyForReviewTransaction = async (
    creatorKey: UserKey,
    payerAccount: HederaAccount,
  ): Promise<Transaction> => {
    const client = Client.forLocalNode();

    try {
      const sdkTransaction = new AccountCreateTransaction()
        .setTransactionId(createTransactionId(payerAccount.accountId!))
        .setKey(payerAccount.publicKey!);
      sdkTransaction.freezeWith(client);

      const transaction = transactionRepo.create({
        name: 'TEST Reviewer Transaction',
        description: 'TEST This is a transaction under review',
        type: getTransactionTypeEnumValue(sdkTransaction),
        transactionId: sdkTransaction.transactionId!.toString(),
        transactionBytes: Buffer.from(sdkTransaction.toBytes()),
        unsignedTransactionBytes: Buffer.from(sdkTransaction.toBytes()),
        transactionHash: Buffer.from(await sdkTransaction.getTransactionHash()).toString('hex'),
        creatorKey: { id: creatorKey.id },
        signature: Buffer.from(payerAccount.privateKey!.sign(sdkTransaction.toBytes())),
        mirrorNetwork: payerAccount.mirrorNetwork,
        status: TransactionStatus.READY_FOR_REVIEW,
        validStart: sdkTransaction.transactionId!.validStart!.toDate(),
      });

      return await transactionRepo.save(transaction);
    } finally {
      client.close();
    }
  };

  const signReview = (
    key: PrivateKey,
    transactionId: number,
    accepted: boolean,
    note: string | undefined,
    transactionHash: string,
  ): string =>
    '0x' +
    Buffer.from(
      key.sign(buildReviewAttestationMessage(transactionId, accepted, note, transactionHash)),
    ).toString('hex');

  beforeAll(async () => {
    await resetDatabase();
    await addHederaLocalnetAccounts();
    addedTransactions = await addTransactions();

    transactionRepo = await getRepository(Transaction);
    reviewerListMemberRepo = await getRepository(TransactionReviewerListMember);

    admin = (await getUser('admin'))!;
    user = (await getUser('user'))!;
    adminKey1002 = (await getUserKey(admin.id, localnet1002.publicKeyRaw!))!;

    reviewerKeyA = PrivateKey.generateED25519();
    reviewerKeyB = PrivateKey.generateED25519();
    await attachKeyToUser(user.id, { publicKey: reviewerKeyA.publicKey.toStringRaw() });
    await attachKeyToUser(user.id, { publicKey: reviewerKeyB.publicKey.toStringRaw() });
    reviewerUserKeyA = (await getUserKey(user.id, reviewerKeyA.publicKey.toStringRaw()))!;
    reviewerUserKeyB = (await getUserKey(user.id, reviewerKeyB.publicKey.toStringRaw()))!;

    app = await createNestApp();
    server = app.getHttpServer();
    endpoint = new Endpoint(server, '/transactions');

    adminAuthToken = await login(app, 'admin');
    userAuthToken = await login(app, 'user');
  });

  afterAll(async () => {
    await closeApp(app);
  });

  describe('/transactions/:transactionId/review', () => {
    it('(POST) should accept a review and transition the transaction to WAITING_FOR_SIGNATURES', async () => {
      const transaction = await createReadyForReviewTransaction(adminKey1002, localnet1002);
      const { list, members } = await addReviewerList(transaction.id, 1, [
        { userId: user.id, userKeyId: reviewerUserKeyA.id },
      ]);

      const signature = signReview(
        reviewerKeyA,
        transaction.id,
        true,
        undefined,
        transaction.transactionHash,
      );

      const { status } = await endpoint.post(
        {
          accepted: true,
          signatures: [{ userKeyId: reviewerUserKeyA.id, signature }],
        },
        `/${transaction.id}/review`,
        userAuthToken,
      );

      expect(status).toBe(204);

      const updatedTransaction = await transactionRepo.findOne({ where: { id: transaction.id } });
      expect(updatedTransaction?.status).toBe(TransactionStatus.WAITING_FOR_SIGNATURES);

      const memberEntry = await reviewerListMemberRepo.findOne({ where: { id: members[0].id } });
      expect(memberEntry?.accepted).toBe(true);
      expect(memberEntry?.actionedAt).not.toBeNull();
      expect(memberEntry?.signature).not.toBeNull();

      expect(list.threshold).toBe(1);
    });

    it('(POST) should reject a review and leave the transaction READY_FOR_REVIEW', async () => {
      const transaction = await createReadyForReviewTransaction(adminKey1002, localnet1002);
      const { members } = await addReviewerList(transaction.id, 1, [
        { userId: user.id, userKeyId: reviewerUserKeyA.id },
      ]);

      const note = 'This transaction looks wrong';
      const signature = signReview(
        reviewerKeyA,
        transaction.id,
        false,
        note,
        transaction.transactionHash,
      );

      const { status } = await endpoint.post(
        {
          accepted: false,
          note,
          signatures: [{ userKeyId: reviewerUserKeyA.id, signature }],
        },
        `/${transaction.id}/review`,
        userAuthToken,
      );

      expect(status).toBe(204);

      const updatedTransaction = await transactionRepo.findOne({ where: { id: transaction.id } });
      expect(updatedTransaction?.status).toBe(TransactionStatus.READY_FOR_REVIEW);

      const memberEntry = await reviewerListMemberRepo.findOne({ where: { id: members[0].id } });
      expect(memberEntry?.accepted).toBe(false);
      expect(memberEntry?.note).toBe(note);
      expect(memberEntry?.actionedAt).not.toBeNull();
    });

    it('(POST) should action pending memberships on multiple reviewer lists signed with different keys in one call', async () => {
      const transaction = await createReadyForReviewTransaction(adminKey1002, localnet1002);
      const { members: membersA } = await addReviewerList(transaction.id, 1, [
        { userId: user.id, userKeyId: reviewerUserKeyA.id },
      ]);
      const { members: membersB } = await addReviewerList(transaction.id, 1, [
        { userId: user.id, userKeyId: reviewerUserKeyB.id },
      ]);

      const signatureA = signReview(
        reviewerKeyA,
        transaction.id,
        true,
        undefined,
        transaction.transactionHash,
      );
      const signatureB = signReview(
        reviewerKeyB,
        transaction.id,
        true,
        undefined,
        transaction.transactionHash,
      );

      const { status } = await endpoint.post(
        {
          accepted: true,
          signatures: [
            { userKeyId: reviewerUserKeyA.id, signature: signatureA },
            { userKeyId: reviewerUserKeyB.id, signature: signatureB },
          ],
        },
        `/${transaction.id}/review`,
        userAuthToken,
      );

      expect(status).toBe(204);

      const memberEntryA = await reviewerListMemberRepo.findOne({ where: { id: membersA[0].id } });
      const memberEntryB = await reviewerListMemberRepo.findOne({ where: { id: membersB[0].id } });
      expect(memberEntryA?.accepted).toBe(true);
      expect(memberEntryB?.accepted).toBe(true);

      const updatedTransaction = await transactionRepo.findOne({ where: { id: transaction.id } });
      expect(updatedTransaction?.status).toBe(TransactionStatus.WAITING_FOR_SIGNATURES);
    });

    it('(POST) should NOT accept a review for a transaction that is not awaiting review', async () => {
      const transaction = addedTransactions!.userTransactions[0];

      const { status, body } = await endpoint.post(
        {
          accepted: true,
          signatures: [{ userKeyId: reviewerUserKeyA.id, signature: '0xdeadbeef' }],
        },
        `/${transaction.id}/review`,
        userAuthToken,
      );

      expect(status).toBe(409);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 409,
          message: ErrorCodes.TRPC,
        }),
      );
    });

    it('(POST) should NOT accept a review from a user with no pending reviewer-list membership', async () => {
      const transaction = await createReadyForReviewTransaction(adminKey1002, localnet1002);
      await addReviewerList(transaction.id, 1, [
        { userId: user.id, userKeyId: reviewerUserKeyA.id },
      ]);

      const { status, body } = await endpoint.post(
        {
          accepted: true,
          signatures: [{ userKeyId: reviewerUserKeyA.id, signature: '0xdeadbeef' }],
        },
        `/${transaction.id}/review`,
        adminAuthToken,
      );

      expect(status).toBe(403);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 403,
          message: ErrorCodes.RNPF,
        }),
      );
    });
  });
});
