import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { guardMock } from '@app/common';
import { Role, TransactionObserver, User, UserStatus } from '@entities';

import { ObserversController } from './observers.controller';

import { ObserversService } from './observers.service';
import { VerifiedUserGuard } from '../../guards';

describe('ObserversController', () => {
  let controller: ObserversController;
  let user: User;
  let observer: TransactionObserver;

  const observersService = mockDeep<ObserversService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ObserversController],
      providers: [
        {
          provide: ObserversService,
          useValue: observersService,
        },
      ],
    })
      .overrideGuard(VerifiedUserGuard)
      .useValue(guardMock())
      .compile();

    controller = module.get<ObserversController>(ObserversController);
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
    observer = {
      id: 1,
      transaction: null,
      createdAt: new Date(),
      user: user,
      role: Role.FULL,
      transactionId: 1,
      userId: 1,
    };
  });

  describe('createTransactionObserver', () => {
    it('should return an array of transaction observers', async () => {
      const body = {
        userIds: [1, 2, 3],
      };
      const result = [observer];

      observersService.createTransactionObservers.mockResolvedValue(result);

      expect(await controller.createTransactionObserver(user, 1, body)).toBe(result);
    });
  });

  describe('getTransactionObserversByTransactionId', () => {
    it('should return a transaction observer', async () => {
      const result = [observer];

      observersService.getTransactionObserversByTransactionId.mockResolvedValue(result);

      expect(await controller.getTransactionObserversByTransactionId(user, 1)).toBe(result);
    });
  });

  describe('updateTransactionObserver', () => {
    it('should return a transaction observer', async () => {
      const body = {
        role: Role.FULL,
      };
      const result = observer;

      observersService.updateTransactionObserver.mockResolvedValue(result);

      expect(await controller.updateTransactionObserver(user, 1, body)).toBe(result);
    });
  });

  describe('removeTransactionObserver', () => {
    it('should return a boolean indicating if the removal was successful', async () => {
      const result = observer;

      observersService.removeTransactionObserver.mockResolvedValue(result);

      expect(await controller.removeTransactionObserver(user, 1)).toBe(result);
    });
  });
});
