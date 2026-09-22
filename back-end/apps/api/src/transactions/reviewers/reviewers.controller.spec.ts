import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { BlacklistService, guardMock } from '@app/common';
import { User, UserStatus } from '@entities';

import { VerifiedUserGuard } from '../../guards';

import { ReviewersController } from './reviewers.controller';
import { ReviewersService } from './reviewers.service';
import { ReviewActionDto } from '../dto';

describe('ReviewersController', () => {
  let controller: ReviewersController;
  let user: User;

  const reviewersService = mockDeep<ReviewersService>();
  const blacklistService = mockDeep<BlacklistService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewersController],
      providers: [
        {
          provide: ReviewersService,
          useValue: reviewersService,
        },
        {
          provide: BlacklistService,
          useValue: blacklistService,
        },
      ],
    })
      .overrideGuard(VerifiedUserGuard)
      .useValue(guardMock())
      .compile();

    controller = module.get<ReviewersController>(ReviewersController);
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
      comments: [],
      issuedNotifications: [],
      receivedNotifications: [],
      notificationPreferences: [],
      clients: [],
    };
  });

  describe('submitReview', () => {
    it('delegates to the service with the transactionId, body, and calling user', async () => {
      const body: ReviewActionDto = {
        accepted: true,
        signatures: [{ userKeyId: 5, signature: '0xdeadbeef' }],
      };

      reviewersService.submitReview.mockResolvedValue(undefined);

      await controller.submitReview(1, body, user);

      expect(reviewersService.submitReview).toHaveBeenCalledWith(1, body, user);
    });

    it('propagates errors thrown by the service', async () => {
      const body: ReviewActionDto = {
        accepted: false,
        signatures: [{ userKeyId: 5, signature: '0xdeadbeef' }],
      };
      const error = new Error('boom');
      reviewersService.submitReview.mockRejectedValue(error);

      await expect(controller.submitReview(1, body, user)).rejects.toThrow(error);
    });
  });
});
