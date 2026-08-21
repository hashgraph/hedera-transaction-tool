import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import {
  Transaction,
  TransactionReviewerList,
  TransactionReviewerListMember,
  TransactionStatus,
  User,
  UserKey,
} from '@entities';
import { ErrorCodes, NatsPublisherService } from '@app/common';

import { ReviewersService } from './reviewers.service';

const makeTransaction = (status: TransactionStatus): Transaction =>
  ({ id: 1, status } as unknown as Transaction);

const makeMember = (overrides: Partial<TransactionReviewerListMember> = {}): TransactionReviewerListMember =>
  ({ id: 10, listId: 1, userId: 42, userKeyId: 5, actionedAt: null, accepted: null, ...overrides } as unknown as TransactionReviewerListMember);

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
  };

  describe('guards', () => {
    it('throws NotFoundException when transaction not found', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(null);

      await expect(service.submitReview(1, { accepted: true }, makeUser())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ConflictException when transaction is not READY_FOR_REVIEW', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.WAITING_FOR_SIGNATURES),
      );

      await expect(
        service.submitReview(1, { accepted: true }, makeUser()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws ForbiddenException RNPF when no pending members found', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );

      setupManagerChain([]);

      await expect(
        service.submitReview(1, { accepted: true }, makeUser()),
      ).rejects.toThrow(ErrorCodes.RNPF);
    });

    it('throws ForbiddenException RKNA when member has no userKeyId', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );

      setupManagerChain([makeMember({ userKeyId: null })]);

      await expect(
        service.submitReview(1, { accepted: true }, makeUser()),
      ).rejects.toThrow(ErrorCodes.RKNA);
    });

    it('throws ForbiddenException RKNA when userKey not found', async () => {
      dataSource.manager.findOne
        .mockResolvedValueOnce(makeTransaction(TransactionStatus.READY_FOR_REVIEW))
        .mockResolvedValueOnce(null); // key lookup

      setupManagerChain([makeMember({ userKeyId: 5 })]);

      await expect(
        service.submitReview(1, { accepted: true }, makeUser()),
      ).rejects.toThrow(ErrorCodes.RKNA);
    });
  });

  describe('threshold evaluation', () => {
    const setupAcceptance = (
      lists: TransactionReviewerList[],
      key: UserKey | null = { id: 5 } as unknown as UserKey,
    ) => {
      dataSource.manager.findOne
        .mockResolvedValueOnce(makeTransaction(TransactionStatus.READY_FOR_REVIEW))
        .mockResolvedValueOnce(key);

      setupManagerChain([makeMember({ userKeyId: 5 })]);

      dataSource.manager.find.mockResolvedValueOnce(lists);
      dataSource.manager.update.mockResolvedValue({} as any);
    };

    it('transitions to WAITING_FOR_SIGNATURES when all lists are satisfied', async () => {
      setupAcceptance([makeList({ threshold: 1, members: [{ accepted: true }] })]);

      await service.submitReview(1, { accepted: true }, makeUser());

      expect(dataSource.manager.update).toHaveBeenCalledWith(
        Transaction,
        1,
        { status: TransactionStatus.WAITING_FOR_SIGNATURES },
      );
      expect(publisher.publish).toHaveBeenCalled();
    });

    it('does not transition when count is one short of threshold', async () => {
      setupAcceptance([makeList({ threshold: 2, members: [{ accepted: true }] })]);

      await service.submitReview(1, { accepted: true }, makeUser());

      expect(dataSource.manager.update).not.toHaveBeenCalled();
    });

    it('transitions when count exactly equals threshold', async () => {
      setupAcceptance([
        makeList({
          threshold: 2,
          members: [{ id: 10, accepted: true }, { id: 11, accepted: true }],
        }),
      ]);

      await service.submitReview(1, { accepted: true }, makeUser());

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

      await service.submitReview(1, { accepted: true }, makeUser());

      expect(dataSource.manager.update).not.toHaveBeenCalled();
    });

    it('rejections do not count toward threshold', async () => {
      setupAcceptance([
        makeList({
          threshold: 2,
          members: [{ id: 10, accepted: true }, { id: 11, accepted: false }],
        }),
      ]);

      await service.submitReview(1, { accepted: true }, makeUser());

      expect(dataSource.manager.update).not.toHaveBeenCalled();
    });
  });

  describe('rejection notification', () => {
    it('emits reviewer-rejection NATS event when reviewer rejects', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );

      setupManagerChain([makeMember()]);

      await service.submitReview(1, { accepted: false, note: 'bad tx' }, makeUser());

      expect(publisher.publish).toHaveBeenCalledWith(
        expect.stringContaining('reviewer-rejection'),
        expect.any(Array),
      );
    });

    it('does not emit status-update NATS event when reviewer rejects', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(
        makeTransaction(TransactionStatus.READY_FOR_REVIEW),
      );

      setupManagerChain([makeMember()]);

      await service.submitReview(1, { accepted: false, note: 'rejected' }, makeUser());

      expect(publisher.publish).not.toHaveBeenCalledWith(
        expect.stringContaining('status-update'),
        expect.any(Array),
      );
    });
  });
});
