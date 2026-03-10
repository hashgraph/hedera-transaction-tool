import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { BlacklistService, guardMock } from '@app/common';
import { TransactionGroup, User, UserStatus } from '@entities';

import { VerifiedUserGuard } from '../../guards';
import { CancelFailureCode, CancelGroupResultDto } from '../dto';

import { TransactionGroupsController } from './transaction-groups.controller';
import { TransactionGroupsService } from './transaction-groups.service';

describe('TransactionGroupsController', () => {
  let controller: TransactionGroupsController;
  let user: User;
  let transactionGroup: TransactionGroup;

  const transactionGroupsService = mockDeep<TransactionGroupsService>();
  const blacklistService = mockDeep<BlacklistService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionGroupsController],
      providers: [
        {
          provide: TransactionGroupsService,
          useValue: transactionGroupsService,
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

    controller = module.get<TransactionGroupsController>(TransactionGroupsController);
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
      comments: [],
      issuedNotifications: [],
      receivedNotifications: [],
      notificationPreferences: [],
      clients: [],
    };
    transactionGroup = {
      id: 1,
      description: 'Test Transaction Group Description',
      atomic: false,
      sequential: false,
      groupItems: [],
      createdAt: new Date(),
    };
  });

  describe('createTransactionGroup', () => {
    it('should return a transaction group', async () => {
      const result = transactionGroup;
      const body = {
        description: 'Test Transaction Group Description',
        atomic: false,
        sequential: false,
        groupItems: [],
      };

      transactionGroupsService.createTransactionGroup.mockResolvedValue(result);

      expect(await controller.createTransactionGroup(user, body)).toEqual(result);
    });
  });

  describe('getTransactionGroups', () => {
    it('should return an array of transaction groups', async () => {
      const result = [transactionGroup];

      transactionGroupsService.getTransactionGroups.mockResolvedValue(result);

      expect(await controller.getTransactionGroups()).toEqual(result);
    });
  });

  describe('getTransactionGroup', () => {
    it('should return a transaction group', async () => {
      const result = transactionGroup;

      transactionGroupsService.getTransactionGroup.mockResolvedValue(result);

      expect(await controller.getTransactionGroup(user, 1)).toEqual(result);
    });
  });

  describe('removeTransactionGroup', () => {
    it('should return void', async () => {
      transactionGroupsService.removeTransactionGroup.mockReturnValue(undefined);

      expect(await controller.removeTransactionGroup(user, 1)).toBeUndefined();
    });
  });

  describe('cancelTransactionGroup', () => {
    const cancelResult: CancelGroupResultDto = {
      canceled: [1],
      alreadyCanceled: [2],
      failed: [
        {
          id: 3,
          code: CancelFailureCode.NOT_CANCELABLE,
          message: 'Transaction cannot be canceled in its current state.',
        },
      ],
      summary: {
        total: 3,
        canceled: 1,
        alreadyCanceled: 1,
        failed: 1,
      },
    };

    it('should delegate to service with user and group id', async () => {
      transactionGroupsService.cancelTransactionGroup.mockResolvedValue(cancelResult);

      await controller.cancelTransactionGroup(user, 42);

      expect(transactionGroupsService.cancelTransactionGroup).toHaveBeenCalledWith(user, 42);
    });

    it('should return service payload as-is', async () => {
      transactionGroupsService.cancelTransactionGroup.mockResolvedValue(cancelResult);

      await expect(controller.cancelTransactionGroup(user, 1)).resolves.toEqual(cancelResult);
    });

    it('should propagate service errors', async () => {
      const error = new Error('Cancellation failed');
      transactionGroupsService.cancelTransactionGroup.mockRejectedValue(error);

      await expect(controller.cancelTransactionGroup(user, 1)).rejects.toThrow(
        'Cancellation failed',
      );
    });
  });
});
