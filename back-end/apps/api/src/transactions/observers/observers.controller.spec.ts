import { Test, TestingModule } from '@nestjs/testing';
import { ObserversController } from './observers.controller';
import { Role, TransactionObserver, User, UserStatus } from '@entities';
import { describe } from 'node:test';
import { ObserversService } from './observers.service';

describe('ObserversController', () => {
  let controller: ObserversController;
  let user: User;
  let observer: TransactionObserver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ObserversController],
      providers: [
        {
          provide: ObserversService,
          useValue: {
            getTransactionObserverById: jest.fn(),
            getObserversByTransactionId: jest.fn(),
            getVerifiedObserversByTransactionId: jest.fn(),
            getTransactionObserversById: jest.fn(),
            getRootNodeFromNode: jest.fn(),
            removeNode: jest.fn(),
            createTransactionObservers: jest.fn(),
            updateTransactionObserver: jest.fn(),
            removeTransactionObserver: jest.fn(),
            approveTransaction: jest.fn(),
            getCreatorsTransaction: jest.fn(),
            getTreeStructure: jest.fn(),
          }
        },
      ]
    }).compile();

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
      comments: []
    };
    observer = {
      id: 1,
      transaction: null,
      createdAt: new Date(),
      user: user,
      role: Role.FULL,
      transactionId: 1,
      userId: 1
    };
  });

  describe('createTransactionObserver', () => {
    it('should return an array of transaction observers', async () => {
      const body = {
        userIds: [1, 2, 3]
      };
      const result = [observer];


      jest.spyOn(controller, 'createTransactionObserver').mockResolvedValue(result);

      expect(await controller.createTransactionObserver(user, 1, body)).toBe(result);
    });
  });

  describe('getTransactionObserversByTransactionId', () => {
    it('should return a transaction observer', async () => {
      const result = [observer];

      jest.spyOn(controller, 'getTransactionObserversByTransactionId').mockResolvedValue(result);

      expect(await controller.getTransactionObserversByTransactionId(user, 1)).toBe(result);
    });
  });

  describe('updateTransactionObserver', () => {
    it('should return a transaction observer', async () => {
      const body = {
        role: Role.FULL
      };
      const result = observer;

      jest.spyOn(controller, 'updateTransactionObserver').mockResolvedValue(result);

      expect(await controller.updateTransactionObserver(user, 1, body)).toBe(result);
    });
  });

  describe('removeTransactionObserver', () => {
    it('should return a boolean indicating if the removal was successful', async () => {
      const result = observer;

      jest.spyOn(controller, 'removeTransactionObserver').mockResolvedValue(result);

      expect(await controller.removeTransactionObserver(user, 1)).toBe(result);
    });
  });
});
