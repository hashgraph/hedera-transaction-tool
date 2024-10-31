import { Test, TestingModule } from '@nestjs/testing';
import { mock, mockDeep } from 'jest-mock-extended';
import { ClientProxy } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import {
  Role,
  Transaction,
  TransactionApprover,
  TransactionObserver,
  TransactionStatus,
  User,
} from '@entities';

import { NOTIFICATIONS_SERVICE, MirrorNodeService, ErrorCodes } from '@app/common';
import { userKeysRequiredToSign, notifyTransactionAction } from '@app/common/utils';

import { ObserversService } from './observers.service';
import { ApproversService } from '../approvers';

jest.mock('@app/common/utils');

describe('ObserversService', () => {
  let service: ObserversService;

  const observersRepo = mockDeep<Repository<TransactionObserver>>();
  const entityManager = mockDeep<EntityManager>();
  const approversService = mock<ApproversService>();
  const mirrorNodeService = mock<MirrorNodeService>();
  const notificationsService = mock<ClientProxy>();

  const user = {
    id: 1,
    keys: [
      { id: 3, publicKey: '61f37fc1bbf3ff4453712ee6a305c5c7255955f7889ec3bf30426f1863158ef4' },
    ],
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObserversService,
        {
          provide: getRepositoryToken(TransactionObserver),
          useValue: observersRepo,
        },
        {
          provide: EntityManager,
          useValue: entityManager,
        },
        {
          provide: ApproversService,
          useValue: approversService,
        },
        {
          provide: MirrorNodeService,
          useValue: mirrorNodeService,
        },
        {
          provide: NOTIFICATIONS_SERVICE,
          useValue: notificationsService,
        },
      ],
    }).compile();

    service = module.get<ObserversService>(ObserversService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTransactionObservers', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should create transaction observers', async () => {
      const transactionId = 1;
      const dto = { userIds: [2] };

      const transaction = { creatorKey: { userId: user.id }, observers: [] };
      entityManager.findOne.mockResolvedValue(transaction);

      const observer = { userId: 2, transactionId, role: Role.FULL } as TransactionObserver;
      observersRepo.create.mockReturnValue(observer);

      await service.createTransactionObservers(user, transactionId, dto);

      expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: transactionId },
        relations: ['creatorKey', 'creatorKey.user', 'observers'],
      });
      expect(observersRepo.create).toHaveBeenCalledWith(observer);
      expect(observersRepo.save).toHaveBeenCalledWith([observer]);
    });

    it('should not add an observer if already added', async () => {
      const transactionId = 1;
      const dto = { userIds: [3] };

      const transaction = { creatorKey: { userId: user.id }, observers: [{ userId: 3 }] };
      entityManager.findOne.mockResolvedValue(transaction);

      const result = await service.createTransactionObservers(user, transactionId, dto);

      expect(result).toEqual([]);
      expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: transactionId },
        relations: ['creatorKey', 'creatorKey.user', 'observers'],
      });
      expect(observersRepo.create).not.toHaveBeenCalled();
      expect(observersRepo.save).not.toHaveBeenCalled();
    });

    it('should throw not found exception', async () => {
      const transactionId = 1;
      const dto = { userIds: [2] };

      entityManager.findOne.mockResolvedValue(null);

      await expect(service.createTransactionObservers(user, transactionId, dto)).rejects.toThrow(
        ErrorCodes.TNF,
      );
    });

    it('should throw unauthorized exception', async () => {
      const transactionId = 1;
      const dto = { userIds: [2] };

      const transaction = { creatorKey: { userId: 2 } };
      entityManager.findOne.mockResolvedValue(transaction);

      await expect(service.createTransactionObservers(user, transactionId, dto)).rejects.toThrow(
        'Only the creator of the transaction is able to delete it',
      );
    });

    it('should throw if saving of observers fails', async () => {
      const transactionId = 1;
      const dto = { userIds: [2] };

      const transaction = { creatorKey: { userId: user.id }, observers: [] };
      entityManager.findOne.mockResolvedValue(transaction);

      const observer = { userId: 2, transactionId, role: Role.FULL } as TransactionObserver;
      observersRepo.create.mockReturnValue(observer);
      observersRepo.save.mockRejectedValue(new Error('Error'));

      await expect(service.createTransactionObservers(user, transactionId, dto)).rejects.toThrow(
        'Error',
      );
    });
  });

  describe('getTransactionObserversByTransactionId', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should get transaction observers by transaction id if user is creator', async () => {
      const transactionId = 1;
      const transaction = { creatorKey: { userId: user.id } };
      entityManager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);

      await service.getTransactionObserversByTransactionId(transactionId, user);

      expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: transactionId },
        relations: ['creatorKey', 'observers', 'signers', 'signers.userKey'],
      });
    });

    it('should get observers if user is observer', async () => {
      const transactionId = 1;
      const observers = [{ userId: user.id }];
      const transaction = { id: transactionId, observers, signers: [] };
      entityManager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);
      approversService.getApproversByTransactionId.mockResolvedValue([]);

      const result = await service.getTransactionObserversByTransactionId(transactionId, user);

      expect(result).toEqual(observers);
    });

    it('should get observers if user is signer', async () => {
      const transactionId = 1;
      const signers = [{ userKey: { userId: user.id } }];
      const transaction = { id: transactionId, observers: [], signers };
      entityManager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);
      approversService.getApproversByTransactionId.mockResolvedValue([]);

      const result = await service.getTransactionObserversByTransactionId(transactionId, user);

      expect(result).toEqual([]);
    });

    it('should get observers if user is approver', async () => {
      const transactionId = 1;
      const transaction = { id: transactionId, observers: [], signers: [] };
      entityManager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);

      const approvers = [{ userId: user.id }] as TransactionApprover[];
      approversService.getApproversByTransactionId.mockResolvedValue(approvers);

      const result = await service.getTransactionObserversByTransactionId(transactionId, user);

      expect(result).toEqual([]);
    });

    it('should get transaction observers when transaction is visible for everyone', async () => {
      const transactionId = 1;
      const observers = [{ userId: 2 }, { userId: 3 }];
      const transaction = {
        creatorKey: { userId: user.id },
        status: TransactionStatus.EXECUTED,
        observers,
      };
      entityManager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);

      const result = await service.getTransactionObserversByTransactionId(transactionId, user);

      expect(result).toEqual(observers);
    });

    it('should throw not found exception', async () => {
      const transactionId = 1;
      entityManager.findOne.mockResolvedValue(null);

      await expect(
        service.getTransactionObserversByTransactionId(transactionId, user),
      ).rejects.toThrow(ErrorCodes.TNF);
    });

    it('should throw if user has not access to this transaction', async () => {
      const transactionId = 1;
      const transaction = { id: transactionId, observers: [], signers: [] };
      entityManager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);
      approversService.getApproversByTransactionId.mockResolvedValue([]);

      await expect(
        service.getTransactionObserversByTransactionId(transactionId, user),
      ).rejects.toThrow("You don't have permission to view this transaction");
    });
  });

  describe('updateTransactionObserver', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should update transaction observer', async () => {
      const observerId = 1;
      const dto = { role: Role.FULL };
      const transaction = { creatorKey: { userId: user.id } };
      const observer = { id: observerId, userId: user.id } as TransactionObserver;

      observersRepo.findOneBy.mockResolvedValue(observer);
      entityManager.findOne.mockResolvedValueOnce(transaction);

      await service.updateTransactionObserver(observerId, dto, user);

      expect(observersRepo.findOneBy).toHaveBeenCalledWith({ id: observerId });
      expect(observersRepo.save).toHaveBeenCalledWith(observer);

      expect(notifyTransactionAction).toHaveBeenCalled();
    });

    it('should not update the transaction observer if not creator', async () => {
      const observerId = 1;
      const dto = { role: Role.FULL };
      const transaction = { creatorKey: { userId: 2 } };
      const observer = { id: observerId, userId: user.id } as TransactionObserver;

      observersRepo.findOneBy.mockResolvedValue(observer);
      entityManager.findOne.mockResolvedValueOnce(transaction);

      await expect(service.updateTransactionObserver(observerId, dto, user)).rejects.toThrow(
        'Only the creator of the transaction is able to update it',
      );
    });

    it('should throw if update non existing observer', async () => {
      const observerId = 1;
      const dto = { role: Role.FULL };
      observersRepo.findOneBy.mockResolvedValue(null);

      await expect(service.updateTransactionObserver(observerId, dto, user)).rejects.toThrow(
        ErrorCodes.ONF,
      );
    });

    it('should throw if update observer of non existing transaction', async () => {
      const observerId = 1;
      const dto = { role: Role.FULL };
      const observer = { id: observerId, userId: user.id } as TransactionObserver;

      observersRepo.findOneBy.mockResolvedValue(observer);
      entityManager.findOne.mockResolvedValue(null);

      await expect(service.updateTransactionObserver(observerId, dto, user)).rejects.toThrow(
        ErrorCodes.TNF,
      );
    });
  });

  describe('removeTransactionObserver', () => {
    it('should remove transaction observer', async () => {
      const observerId = 1;
      const transaction = { creatorKey: { userId: user.id } };
      const observer = { id: observerId, userId: user.id } as TransactionObserver;

      observersRepo.findOneBy.mockResolvedValue(observer);
      entityManager.findOne.mockResolvedValueOnce(transaction);

      await service.removeTransactionObserver(observerId, user);

      expect(observersRepo.findOneBy).toHaveBeenCalledWith({ id: observerId });
      expect(observersRepo.remove).toHaveBeenCalledWith(observer);

      expect(notifyTransactionAction).toHaveBeenCalled();
    });

    it('should not remove the transaction observer if not creator', async () => {
      const observerId = 1;
      const transaction = { creatorKey: { userId: 2 } };
      const observer = { id: observerId, userId: user.id } as TransactionObserver;

      observersRepo.findOneBy.mockResolvedValue(observer);
      entityManager.findOne.mockResolvedValueOnce(transaction);

      await expect(service.removeTransactionObserver(observerId, user)).rejects.toThrow(
        'Only the creator of the transaction is able to update it',
      );
    });
  });
});
