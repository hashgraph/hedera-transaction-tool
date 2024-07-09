import { Test, TestingModule } from '@nestjs/testing';

import { guardMock } from '@app/common';
import { TransactionGroup, User, UserStatus } from '@entities';

import { TransactionGroupsController } from './transaction-groups.controller';

import { TransactionGroupsService } from './transaction-groups.service';
import { VerifiedUserGuard } from '../../guards';

describe('TransactionGroupsController', () => {
  let controller: TransactionGroupsController;
  let user: User;
  let transactionGroup: TransactionGroup;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionGroupsController],
      providers: [
        {
          provide: TransactionGroupsService,
          useValue: {
            createTransactionGroup: jest.fn(),
            getTransactionGroups: jest.fn(),
            removeTransactionGroup: jest.fn(),
          },
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
    };
    transactionGroup = {
      id: 1,
      description: 'Test Transaction Group Description',
      atomic: false,
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
        groupItems: [],
      };

      jest.spyOn(controller, 'createTransactionGroup').mockResolvedValue(result);

      expect(await controller.createTransactionGroup(user, body)).toEqual(result);
    });
  });

  describe('getTransactionGroups', () => {
    it('should return an array of transaction groups', async () => {
      const result = [transactionGroup];

      jest.spyOn(controller, 'getTransactionGroups').mockResolvedValue(result);

      expect(await controller.getTransactionGroups()).toEqual(result);
    });
  });

  describe('removeTransactionGroup', () => {
    it('should return void', async () => {
      jest.spyOn(controller, 'removeTransactionGroup').mockReturnValue(undefined);

      expect(await controller.removeTransactionGroup(user, 1)).toBeUndefined();
    });
  });
});
