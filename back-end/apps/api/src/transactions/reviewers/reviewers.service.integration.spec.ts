import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PrivateKey } from '@hiero-ledger/sdk';

import {
  Transaction,
  TransactionReviewerList,
  TransactionReviewerListMember,
  TransactionStatus,
  TransactionType,
  User,
  UserKey,
  UserStatus,
} from '@entities';
import { NatsPublisherService } from '@app/common';
import { createTestPostgresDataSource } from '../../../../../test-utils/postgres-test-db';

import { buildReviewAttestationMessage, ReviewersService } from './reviewers.service';

/**
 * Integration tests for ReviewersService against a real Postgres container.
 *
 * reviewers.service.spec.ts covers the business logic with a fully mocked DataSource;
 * it never actually executes the query builder joins (findPendingMembers), the whereInIds
 * update, or the relation-loaded threshold aggregation (allListsSatisfied) against a real
 * database, so a broken column/join name there would not be caught by that suite. These
 * tests exercise the same paths with real rows.
 */
describe('ReviewersService - Integration', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  let service: ReviewersService;
  let publisher: NatsPublisherService;

  beforeAll(async () => {
    const testDb = await createTestPostgresDataSource();
    dataSource = testDb.dataSource;
    cleanup = testDb.cleanup;
  }, 120_000);

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    for (const entity of [
      TransactionReviewerListMember,
      TransactionReviewerList,
      Transaction,
      UserKey,
      User,
    ]) {
      await dataSource.getRepository(entity).createQueryBuilder().delete().execute();
    }

    publisher = { publish: jest.fn().mockResolvedValue({ success: true }) } as unknown as NatsPublisherService;
    service = new ReviewersService(dataSource, publisher);
  });

  const createUser = async (email: string) =>
    dataSource.getRepository(User).save({
      email,
      password: 'hashed',
      status: UserStatus.NONE,
      admin: false,
    });

  const createUserKey = async (userId: number, publicKey: string) =>
    dataSource.getRepository(UserKey).save({ userId, publicKey });

  const createTransaction = async (creatorKeyId: number, status: TransactionStatus, transactionHash: string) =>
    dataSource.getRepository(Transaction).save({
      name: 'Test Transaction',
      type: TransactionType.TRANSFER,
      description: 'Test Transaction',
      transactionId: `0.0.100@${Date.now()}.0`,
      transactionHash,
      transactionBytes: Buffer.from('tx-bytes'),
      unsignedTransactionBytes: Buffer.from('unsigned-tx-bytes'),
      status,
      creatorKeyId,
      signature: Buffer.from('signature'),
      validStart: new Date(),
      mirrorNetwork: 'mainnet',
    });

  const createReviewerList = async (transactionId: number, threshold: number) =>
    dataSource.getRepository(TransactionReviewerList).save({ transactionId, threshold, name: null, description: null });

  const createReviewerMember = async (
    listId: number,
    userId: number,
    userKeyId: number | null,
    overrides: Partial<TransactionReviewerListMember> = {},
  ) =>
    dataSource.getRepository(TransactionReviewerListMember).save({
      listId,
      userId,
      userKeyId,
      accepted: null,
      note: null,
      signature: null,
      actionedAt: null,
      ...overrides,
    });

  const signAttestation = (
    key: PrivateKey,
    transactionId: number,
    accepted: boolean,
    note: string | undefined,
    transactionHash: string,
  ): string =>
    '0x' +
    Buffer.from(key.sign(buildReviewAttestationMessage(transactionId, accepted, note, transactionHash))).toString('hex');

  it('throws NotFoundException when the transaction does not exist', async () => {
    const user = await createUser('reviewer@test.com');

    await expect(
      service.submitReview(999_999, { accepted: true, signatures: [] }, user),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ConflictException when the transaction is not READY_FOR_REVIEW', async () => {
    const creator = await createUser('creator@test.com');
    const creatorKey = await createUserKey(creator.id, 'creator-pub-key');
    const transaction = await createTransaction(creatorKey.id, TransactionStatus.WAITING_FOR_SIGNATURES, 'hash-1');

    await expect(
      service.submitReview(transaction.id, { accepted: true, signatures: [] }, creator),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws ForbiddenException when the user has no pending membership on this transaction', async () => {
    const creator = await createUser('creator2@test.com');
    const creatorKey = await createUserKey(creator.id, 'creator-pub-key-2');
    const transaction = await createTransaction(creatorKey.id, TransactionStatus.READY_FOR_REVIEW, 'hash-2');

    const outsider = await createUser('outsider@test.com');

    await expect(
      service.submitReview(transaction.id, { accepted: true, signatures: [] }, outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('transitions a real transaction to WAITING_FOR_SIGNATURES once its single reviewer list is satisfied', async () => {
    const creator = await createUser('creator3@test.com');
    const creatorKey = await createUserKey(creator.id, 'creator-pub-key-3');
    const transactionHash = 'hash-3';
    const transaction = await createTransaction(creatorKey.id, TransactionStatus.READY_FOR_REVIEW, transactionHash);

    const reviewer = await createUser('reviewer3@test.com');
    const reviewerPk = PrivateKey.generateED25519();
    const reviewerKey = await createUserKey(reviewer.id, reviewerPk.publicKey.toStringRaw());

    const list = await createReviewerList(transaction.id, 1);
    await createReviewerMember(list.id, reviewer.id, reviewerKey.id);

    const signature = signAttestation(reviewerPk, transaction.id, true, undefined, transactionHash);
    await service.submitReview(
      transaction.id,
      { accepted: true, signatures: [{ userKeyId: reviewerKey.id, signature }] },
      reviewer,
    );

    const updatedTransaction = await dataSource.getRepository(Transaction).findOneOrFail({
      where: { id: transaction.id },
    });
    expect(updatedTransaction.status).toBe(TransactionStatus.WAITING_FOR_SIGNATURES);

    const updatedMember = await dataSource.getRepository(TransactionReviewerListMember).findOneOrFail({
      where: { listId: list.id, userId: reviewer.id },
    });
    expect(updatedMember.accepted).toBe(true);
    expect(updatedMember.actionedAt).not.toBeNull();
    expect(publisher.publish).toHaveBeenCalledWith(expect.stringContaining('status-update'), expect.any(Array));
  });

  it('leaves the transaction READY_FOR_REVIEW when a second reviewer list is still unsatisfied', async () => {
    const creator = await createUser('creator4@test.com');
    const creatorKey = await createUserKey(creator.id, 'creator-pub-key-4');
    const transactionHash = 'hash-4';
    const transaction = await createTransaction(creatorKey.id, TransactionStatus.READY_FOR_REVIEW, transactionHash);

    const reviewer = await createUser('reviewer4@test.com');
    const reviewerPk = PrivateKey.generateED25519();
    const reviewerKey = await createUserKey(reviewer.id, reviewerPk.publicKey.toStringRaw());

    const satisfiedList = await createReviewerList(transaction.id, 1);
    await createReviewerMember(satisfiedList.id, reviewer.id, reviewerKey.id);

    // A second list on the same transaction that this reviewer isn't part of, still pending.
    const otherReviewer = await createUser('other-reviewer4@test.com');
    const otherReviewerKey = await createUserKey(otherReviewer.id, 'other-pub-key-4');
    const unsatisfiedList = await createReviewerList(transaction.id, 1);
    await createReviewerMember(unsatisfiedList.id, otherReviewer.id, otherReviewerKey.id);

    const signature = signAttestation(reviewerPk, transaction.id, true, undefined, transactionHash);
    await service.submitReview(
      transaction.id,
      { accepted: true, signatures: [{ userKeyId: reviewerKey.id, signature }] },
      reviewer,
    );

    const updatedTransaction = await dataSource.getRepository(Transaction).findOneOrFail({
      where: { id: transaction.id },
    });
    expect(updatedTransaction.status).toBe(TransactionStatus.READY_FOR_REVIEW);
  });

  it('rejects and emits reviewer-rejection without transitioning the transaction', async () => {
    const creator = await createUser('creator5@test.com');
    const creatorKey = await createUserKey(creator.id, 'creator-pub-key-5');
    const transactionHash = 'hash-5';
    const transaction = await createTransaction(creatorKey.id, TransactionStatus.READY_FOR_REVIEW, transactionHash);

    const reviewer = await createUser('reviewer5@test.com');
    const reviewerPk = PrivateKey.generateED25519();
    const reviewerKey = await createUserKey(reviewer.id, reviewerPk.publicKey.toStringRaw());

    const list = await createReviewerList(transaction.id, 1);
    await createReviewerMember(list.id, reviewer.id, reviewerKey.id);

    const signature = signAttestation(reviewerPk, transaction.id, false, 'not valid', transactionHash);
    await service.submitReview(
      transaction.id,
      { accepted: false, note: 'not valid', signatures: [{ userKeyId: reviewerKey.id, signature }] },
      reviewer,
    );

    const updatedTransaction = await dataSource.getRepository(Transaction).findOneOrFail({
      where: { id: transaction.id },
    });
    expect(updatedTransaction.status).toBe(TransactionStatus.READY_FOR_REVIEW);

    const updatedMember = await dataSource.getRepository(TransactionReviewerListMember).findOneOrFail({
      where: { listId: list.id, userId: reviewer.id },
    });
    expect(updatedMember.accepted).toBe(false);
    expect(updatedMember.note).toBe('not valid');
    expect(publisher.publish).toHaveBeenCalledWith(expect.stringContaining('reviewer-rejection'), expect.any(Array));
  });

  it('only actions the pending membership tied to the submitted key, leaving a different list pending', async () => {
    const creator = await createUser('creator6@test.com');
    const creatorKey = await createUserKey(creator.id, 'creator-pub-key-6');
    const transactionHash = 'hash-6';
    const transaction = await createTransaction(creatorKey.id, TransactionStatus.READY_FOR_REVIEW, transactionHash);

    const reviewer = await createUser('reviewer6@test.com');
    const keyA = PrivateKey.generateED25519();
    const keyB = PrivateKey.generateED25519();
    const userKeyA = await createUserKey(reviewer.id, keyA.publicKey.toStringRaw());
    const userKeyB = await createUserKey(reviewer.id, keyB.publicKey.toStringRaw());

    const listA = await createReviewerList(transaction.id, 1);
    await createReviewerMember(listA.id, reviewer.id, userKeyA.id);
    const listB = await createReviewerList(transaction.id, 1);
    await createReviewerMember(listB.id, reviewer.id, userKeyB.id);

    // Only submits the signature for key A; the reviewer doesn't have key B on this device.
    const signature = signAttestation(keyA, transaction.id, true, undefined, transactionHash);
    await service.submitReview(
      transaction.id,
      { accepted: true, signatures: [{ userKeyId: userKeyA.id, signature }] },
      reviewer,
    );

    const memberA = await dataSource.getRepository(TransactionReviewerListMember).findOneOrFail({
      where: { listId: listA.id, userId: reviewer.id },
    });
    const memberB = await dataSource.getRepository(TransactionReviewerListMember).findOneOrFail({
      where: { listId: listB.id, userId: reviewer.id },
    });
    expect(memberA.actionedAt).not.toBeNull();
    expect(memberB.actionedAt).toBeNull();

    const updatedTransaction = await dataSource.getRepository(Transaction).findOneOrFail({
      where: { id: transaction.id },
    });
    expect(updatedTransaction.status).toBe(TransactionStatus.READY_FOR_REVIEW);
  });
});
