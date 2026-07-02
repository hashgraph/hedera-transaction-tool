import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';
import { plainToInstance } from 'class-transformer';

import { BlacklistService, guardMock } from '@app/common';
import { User } from '@entities';

import { TransactionCommentDto } from '../dto';

import { VerifiedUserGuard } from '../../guards';
import { TransactionAccessGuard } from '../../guards/transaction-access.guard';

import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

describe('CommentsController', () => {
  let controller: CommentsController;

  const commentsService = mockDeep<CommentsService>();
  const blacklistService = mockDeep<BlacklistService>();

  let user: Partial<User>;

  beforeEach(async () => {
    user = {
      id: 1,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        {
          provide: CommentsService,
          useValue: commentsService,
        },
        {
          provide: BlacklistService,
          useValue: blacklistService,
        },
      ],
    })
      .overrideGuard(VerifiedUserGuard)
      .useValue(guardMock())
      .overrideGuard(TransactionAccessGuard)
      .useValue(guardMock())
      .compile();

    controller = module.get<CommentsController>(CommentsController);
  });

  describe('createComment', () => {
    it('should return a comment', async () => {
      await controller.createComment(user as User, 1, { message: 'test' });

      expect(commentsService.createComment).toHaveBeenCalledWith(user, 1, { message: 'test' });
    });
  });

  describe('getComments', () => {
    it('should return an array of comments', async () => {
      const id = 1;

      await controller.getComments(id);

      expect(commentsService.getTransactionComments).toHaveBeenCalledWith(id);
    });
  });

  describe('getCommentById', () => {
    it('should return a comment', async () => {
      const tid = 10;
      const id = 1;

      await controller.getCommentById(tid, id);

      expect(commentsService.getTransactionCommentById).toHaveBeenCalledWith(tid, id);
    });
  });

  describe('TransactionCommentDto serialization', () => {
    it('should transform nested user using UserCoreDto', () => {
      const raw = {
        id: 1,
        message: 'hello',
        createdAt: new Date(),
        user: { id: 2, email: 'user@test.com', password: 'secret' },
      };

      const dto = plainToInstance(TransactionCommentDto, raw, { excludeExtraneousValues: true });

      expect(dto.user).toEqual({ id: 2, email: 'user@test.com' });
      expect((dto.user as any).password).toBeUndefined();
    });
  });
});
