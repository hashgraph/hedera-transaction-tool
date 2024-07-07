import { Test, TestingModule } from '@nestjs/testing';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { TransactionComment, User, UserStatus } from '@entities';

describe('CommentsController', () => {
  let controller: CommentsController;
  let user: User;
  let comment: TransactionComment;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        {
          provide: CommentsService,
          useValue: {
            createComment: jest.fn(),
            getTransactionComments: jest.fn(),
            getTransactionCommentById: jest.fn(),
          },
        },
      ]
    }).compile();

    controller = module.get<CommentsController>(CommentsController);
    user = {
      id: 1,
      email: 'John@test.com',
      password: 'Doe',
      admin: true,
      status: UserStatus.NONE,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      keys: [],
      signerForTransactions: [],
      observableTransactions: [],
      approvableTransactions: [],
      comments: []
    };
    comment = {
      id: 1,
      transaction: null,
      user: user,
      message: 'test',
      createdAt: new Date(),
    }
  });

  describe('createComment', () => {
    it('should return a comment', async () => {
      const result = comment;

      jest.spyOn(controller, 'createComment').mockResolvedValue(result);

      expect(await controller.createComment(user, 1, { message: 'test' })).toBe(result);
    });
  });

  describe('getComments', () => {
    it('should return an array of comments', async () => {
      const result = [comment];

      jest.spyOn(controller, 'getComments').mockResolvedValue(result);

      expect(await controller.getComments(1)).toBe(result);
    });
  });

  describe('getCommentById', () => {
    it('should return a comment', async () => {
      const result = comment;

      jest.spyOn(controller, 'getCommentById').mockResolvedValue(result);

      expect(await controller.getCommentById(1)).toBe(result);
    });
  });

});
