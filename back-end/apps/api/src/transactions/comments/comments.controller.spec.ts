import { Test, TestingModule } from '@nestjs/testing';

import { User } from '@entities';

import { CommentsController } from './comments.controller';

import { CommentsService } from './comments.service';
import { VerifiedUserGuard } from '../../guards';
import { mockDeep } from 'jest-mock-extended';

describe('CommentsController', () => {
  let controller: CommentsController;
  const commentsService = mockDeep<CommentsService>();

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
      ],
    })
      .overrideGuard(VerifiedUserGuard)
      .useValue({
        canActivate: jest.fn(() => {
          return true;
        }),
      })
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
      const id = 1;

      await controller.getCommentById(id);

      expect(commentsService.getTransactionCommentById).toHaveBeenCalledWith(id);
    });
  });
});
