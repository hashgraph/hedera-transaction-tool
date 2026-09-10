import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';
import { PrivateKey } from '@hiero-ledger/sdk';

import {
  Transaction,
  TransactionReviewerList,
  TransactionReviewerListMember,
  TransactionStatus,
  User,
  UserKey,
} from '@entities';
import { ErrorCodes, NatsPublisherService } from '@app/common';

import { ReviewersService, buildReviewAttestationMessage } from './reviewers.service';
import { ReviewSignatureDto } from '../dto';

const reviewerKey = PrivateKey.generateED25519();
const otherKey = PrivateKey.generateED25519();
const transactionHash = '0xdeadbeef';

const sign = (
  transactionId: number,
  accepted: boolean,
  note: string | undefined,
  key: PrivateKey = reviewerKey,
): string => {
  const message = buildReviewAttestationMessage(transactionId, accepted, note, transactionHash);
  return '0x' + Buffer.from(key.sign(message)).toString('hex');
};

const signAs = (
  userKeyId: number,
  transactionId: number,
  accepted: boolean,
  note: string | undefined,
  key: PrivateKey = reviewerKey,
): ReviewSignatureDto => ({
  userKeyId,
  signature: sign(transactionId, accepted, note, key),
});

const makeTransaction = (status: TransactionStatus): Transaction =>
  ({ id: 1, status, transactionHash } as unknown as Transaction);

const makeMember = (overrides: Partial<TransactionReviewerListMember> = {}): TransactionReviewerListMember =>
  ({ id: 10, listId: 1, userId: 42, userKeyId: 5, actionedAt: null, accepted: null, ...overrides } as unknown as TransactionReviewerListMember);

const makeUserKey = (overrides: Partial<UserKey> = {}): UserKey =>
  ({ id: 5, publicKey: reviewerKey.publicKey.toStringDer(), ...overrides } as unknown as UserKey);

const makeUser = (id = 42): User => ({ id } as unknown as User);

const makeList = (
  overrides: { id?: number; threshold?: number; members?: Partial<TransactionReviewerListMember>[] } = {},
): TransactionReviewerList => {
  const { members: memberOverrides = [], ...rest } = overrides;
  return {
    id: 1,
    transactionId: 1,
    threshold: 1,
    members: memberOverrides.map(m => makeMember(m)),
    ...rest,
  } as unknown as TransactionReviewerList;
};

describe('ReviewersService', () => {
  let service: ReviewersService;

  const dataSource = mockDeep<DataSource>();
  const publisher = mockDeep<NatsPublisherService>();

  const mockQb = () => {
    const qb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      whereInIds: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
      getMany: jest.fn().mockResolvedValue([]),
    };
    return qb;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewersService,
        { provide: DataSource, useValue: dataSource },
        { provide: NatsPublisherService, useValue: publisher },
      ],
    }).compile();

    service = module.get(ReviewersService);
    jest.resetAllMocks();

    publisher.publish.mockResolvedValue({ success: true } as any);
  });

  const setupManagerChain = (pendingMembers: TransactionReviewerListMember[]) => {
    const qb = mockQb();
    qb.getMany.mockResolvedValue(pendingMembers);

    const updateQb = mockQb();

    dataSource.manager.createQueryBuilder
      .mockReturnValueOnce(qb)
      .mockReturnValueOnce(updateQb);

    dataSource.transaction.mockImplementation(async (cb: any) => {
      const em: any = {
        createQueryBuilder: jest.fn().mockReturnValue(updateQb),
      };
      return cb(em);
    });

    return updateQb;
  };

  describe('guards', () => {
    it('throws NotFoundException when transaction not found', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.submitReview(
          1,
          { accepted: true, signatures: [signAs(5, 1, true, undefined)] },
          makeUser(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when transaction is not READY_FOR_REVIEW', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.WAITING_FOR_SIGNATURES),
      );

      await expect(
        service.submitReview(
          1,
          { accepted: true, signatures: [signAs(5, 1, true, undefined)] },
          makeUser(),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws ForbiddenException RNPF when no pending members found', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );

      setupManagerChain([]);

      await expect(
        service.submitReview(
          1,
          { accepted: true, signatures: [signAs(5, 1, true, undefined)] },
          makeUser(),
        ),
      ).rejects.toThrow(ErrorCodes.RNPF);
    });

    it('throws ForbiddenException RKNA when member has no userKeyId', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );

      setupManagerChain([makeMember({ userKeyId: null })]);

      await expect(
        service.submitReview(
          1,
          { accepted: true, signatures: [signAs(5, 1, true, undefined)] },
          makeUser(),
        ),
      ).rejects.toThrow(ErrorCodes.RKNA);
    });

    it('throws ForbiddenException RKNA when userKey not found', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );
      dataSource.manager.find.mockResolvedValueOnce([]); // key lookup finds nothing

      setupManagerChain([makeMember({ userKeyId: 5 })]);

      await expect(
        service.submitReview(
          1,
          { accepted: true, signatures: [signAs(5, 1, true, undefined)] },
          makeUser(),
        ),
      ).rejects.toThrow(ErrorCodes.RKNA);
    });
  });

  describe('signature verification', () => {
    it('throws ForbiddenException RSIV when signature does not match the assigned key', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );
      dataSource.manager.find.mockResolvedValueOnce([makeUserKey()]);

      setupManagerChain([makeMember({ userKeyId: 5 })]);

      await expect(
        service.submitReview(
          1,
          { accepted: true, signatures: [signAs(5, 1, true, undefined, otherKey)] },
          makeUser(),
        ),
      ).rejects.toThrow(ErrorCodes.RSIV);
    });

    it('throws ForbiddenException RSIV when signature covers a different decision', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );
      dataSource.manager.find.mockResolvedValueOnce([makeUserKey()]);

      setupManagerChain([makeMember({ userKeyId: 5 })]);

      // signed a rejection, submitting as an acceptance
      await expect(
        service.submitReview(
          1,
          { accepted: true, signatures: [signAs(5, 1, false, undefined)] },
          makeUser(),
        ),
      ).rejects.toThrow(ErrorCodes.RSIV);
    });

    it('throws ForbiddenException RSIV when signature is not valid hex', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );
      dataSource.manager.find.mockResolvedValueOnce([makeUserKey()]);

      setupManagerChain([makeMember({ userKeyId: 5 })]);

      await expect(
        service.submitReview(
          1,
          { accepted: true, signatures: [{ userKeyId: 5, signature: 'not-hex' }] },
          makeUser(),
        ),
      ).rejects.toThrow(ErrorCodes.RSIV);
    });

    it('persists the signature bytes on the pending member rows when valid', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );
      dataSource.manager.find
        .mockResolvedValueOnce([makeUserKey()])
        .mockResolvedValueOnce([]);

      const updateQb = setupManagerChain([makeMember({ userKeyId: 5 })]);

      const sigPair = signAs(5, 1, true, undefined);
      await service.submitReview(1, { accepted: true, signatures: [sigPair] }, makeUser());

      expect(updateQb.set).toHaveBeenCalledWith(
        expect.objectContaining({ signature: Buffer.from(sigPair.signature.slice(2), 'hex') }),
      );
    });

    it('signs only the memberships tied to the matching key, leaving others in different lists pending', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );
      // user has two pending memberships in different lists, assigned two different keys
      dataSource.manager.find
        .mockResolvedValueOnce([makeUserKey({ id: 5 })])
        .mockResolvedValueOnce([]);

      const updateQb = setupManagerChain([
        makeMember({ id: 10, listId: 1, userKeyId: 5 }),
        makeMember({ id: 11, listId: 2, userKeyId: 6 }),
      ]);

      // only submits a signature for key 5, has no key 6 available on this device
      await service.submitReview(
        1,
        { accepted: true, signatures: [signAs(5, 1, true, undefined, reviewerKey)] },
        makeUser(),
      );

      expect(updateQb.whereInIds).toHaveBeenCalledWith([10]);
      expect(updateQb.whereInIds).not.toHaveBeenCalledWith([11]);
    });

    it('actions memberships under multiple lists when signatures for both keys are submitted', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );
      dataSource.manager.find
        .mockResolvedValueOnce([
          makeUserKey({ id: 5 }),
          { id: 6, publicKey: otherKey.publicKey.toStringDer() } as unknown as UserKey,
        ])
        .mockResolvedValueOnce([]);

      const updateQb = setupManagerChain([
        makeMember({ id: 10, listId: 1, userKeyId: 5 }),
        makeMember({ id: 11, listId: 2, userKeyId: 6 }),
      ]);

      await service.submitReview(
        1,
        {
          accepted: true,
          signatures: [
            signAs(5, 1, true, undefined, reviewerKey),
            signAs(6, 1, true, undefined, otherKey),
          ],
        },
        makeUser(),
      );

      expect(updateQb.whereInIds).toHaveBeenCalledWith([10]);
      expect(updateQb.whereInIds).toHaveBeenCalledWith([11]);
    });
  });

  describe('threshold evaluation', () => {
    const setupAcceptance = (
      lists: TransactionReviewerList[],
      key: UserKey | null = makeUserKey(),
    ) => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );

      setupManagerChain([makeMember({ userKeyId: 5 })]);

      dataSource.manager.find
        .mockResolvedValueOnce(key ? [key] : [])
        .mockResolvedValueOnce(lists);
      dataSource.manager.update.mockResolvedValue({} as any);
    };

    it('transitions to WAITING_FOR_SIGNATURES when all lists are satisfied', async () => {
      setupAcceptance([makeList({ threshold: 1, members: [{ accepted: true }] })]);

      await service.submitReview(
        1,
        { accepted: true, signatures: [signAs(5, 1, true, undefined)] },
        makeUser(),
      );

      expect(dataSource.manager.update).toHaveBeenCalledWith(
        Transaction,
        1,
        { status: TransactionStatus.WAITING_FOR_SIGNATURES },
      );
      expect(publisher.publish).toHaveBeenCalled();
    });

    it('does not transition when count is one short of threshold', async () => {
      setupAcceptance([makeList({ threshold: 2, members: [{ accepted: true }] })]);

      await service.submitReview(
        1,
        { accepted: true, signatures: [signAs(5, 1, true, undefined)] },
        makeUser(),
      );

      expect(dataSource.manager.update).not.toHaveBeenCalled();
    });

    it('transitions when count exactly equals threshold', async () => {
      setupAcceptance([
        makeList({
          threshold: 2,
          members: [{ id: 10, accepted: true }, { id: 11, accepted: true }],
        }),
      ]);

      await service.submitReview(
        1,
        { accepted: true, signatures: [signAs(5, 1, true, undefined)] },
        makeUser(),
      );

      expect(dataSource.manager.update).toHaveBeenCalledWith(
        Transaction,
        1,
        { status: TransactionStatus.WAITING_FOR_SIGNATURES },
      );
    });

    it('does not transition if a second list is not satisfied', async () => {
      setupAcceptance([
        makeList({ id: 1, threshold: 1, members: [{ accepted: true }] }),
        makeList({ id: 2, threshold: 2, members: [{ accepted: true }] }),
      ]);

      await service.submitReview(
        1,
        { accepted: true, signatures: [signAs(5, 1, true, undefined)] },
        makeUser(),
      );

      expect(dataSource.manager.update).not.toHaveBeenCalled();
    });

    it('rejections do not count toward threshold', async () => {
      setupAcceptance([
        makeList({
          threshold: 2,
          members: [{ id: 10, accepted: true }, { id: 11, accepted: false }],
        }),
      ]);

      await service.submitReview(
        1,
        { accepted: true, signatures: [signAs(5, 1, true, undefined)] },
        makeUser(),
      );

      expect(dataSource.manager.update).not.toHaveBeenCalled();
    });
  });

  describe('rejection notification', () => {
    it('emits reviewer-rejection NATS event when reviewer rejects', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );
      dataSource.manager.find.mockResolvedValueOnce([makeUserKey()]);

      setupManagerChain([makeMember()]);

      await service.submitReview(
        1,
        {
          accepted: false,
          note: 'bad tx',
          signatures: [signAs(5, 1, false, 'bad tx')],
        },
        makeUser(),
      );

      expect(publisher.publish).toHaveBeenCalledWith(
        expect.stringContaining('reviewer-rejection'),
        expect.any(Array),
      );
    });

    it('does not emit status-update NATS event when reviewer rejects', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );
      dataSource.manager.find.mockResolvedValueOnce([makeUserKey()]);

      setupManagerChain([makeMember()]);

      await service.submitReview(
        1,
        {
          accepted: false,
          note: 'rejected',
          signatures: [signAs(5, 1, false, 'rejected')],
        },
        makeUser(),
      );

      expect(publisher.publish).not.toHaveBeenCalledWith(
        expect.stringContaining('status-update'),
        expect.any(Array),
      );
    });
  });
});
