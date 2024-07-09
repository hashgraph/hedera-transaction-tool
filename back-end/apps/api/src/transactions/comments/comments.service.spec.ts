import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import { TransactionComment, User, UserStatus } from '@entities';

import { CreateCommentDto } from '../dto';

import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;

  const repo = mockDeep<Repository<TransactionComment>>();

  const user: Partial<User> = {
    id: 1,
    email: 'some@email.com',
    password: 'hash',
    admin: false,
    status: UserStatus.NONE,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: getRepositoryToken(TransactionComment),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createComment', () => {
    it('should create and save a comment', async () => {
      const transactionId = 123;
      const dto: CreateCommentDto = { message: 'This is a test comment' };
      const expectedComment = {
        ...dto,
        transaction: transactionId,
        user: user,
      } as unknown as TransactionComment;

      repo.create.mockReturnValue(expectedComment);
      repo.save.mockResolvedValue(expectedComment);

      const result = await service.createComment(user as User, transactionId, dto);

      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(repo.save).toHaveBeenCalledWith(expectedComment);
      expect(result).toEqual(expectedComment);
    });
  });

  describe('getTransactionCommentById', () => {
    it('should return a transaction comment by id', async () => {
      const mockComment = { id: 1, message: 'Test comment' } as TransactionComment;
      repo.findOneBy.mockResolvedValue(mockComment);

      const result = await service.getTransactionCommentById(1);

      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(result).toEqual(mockComment);
    });
  });

  describe('getTransactionComments', () => {
    it('should return comments for a given transaction ID', async () => {
      const transactionId = 123;
      const mockComments = [
        { id: 1, message: 'First comment' },
        { id: 2, message: 'Second comment' },
      ] as TransactionComment[];

      repo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockComments),
      } as unknown as SelectQueryBuilder<TransactionComment>);

      const result = await service.getTransactionComments(transactionId);

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('comment');
      expect(result).toEqual(mockComments);
    });
  });
});
