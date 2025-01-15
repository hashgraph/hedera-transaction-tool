import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { BlacklistService, guardMock } from '@app/common';
import { TransactionGroup, User, UserStatus } from '@entities';

import { VerifiedUserGuard } from '../../guards';

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
});
