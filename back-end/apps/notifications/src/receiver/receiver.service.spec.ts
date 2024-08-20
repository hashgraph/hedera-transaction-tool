import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import {
  keysRequiredToSign,
  MirrorNodeService,
  NotifyForTransactionDto,
  NotifyGeneralDto,
} from '@app/common';
import {
  Notification,
  NotificationReceiver,
  NotificationType,
  Transaction,
  UserKey,
} from '@entities';

import { ReceiverService } from './receiver.service';
import { FanOutService } from '../fan-out/fan-out.service';

jest.mock('@app/common/utils');

describe('ReceiverService', () => {
  let service: ReceiverService;
  const entityManager = mockDeep<EntityManager>();
  const mirrorNodeService = mockDeep<MirrorNodeService>();
  const fanOutService = mockDeep<FanOutService>();

  const mockTransaction = () => {
    const transactionMock = jest.fn(async passedFunction => {
      await passedFunction(entityManager);
    });
    entityManager.transaction.mockImplementation(transactionMock);
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiverService,
        {
          provide: EntityManager,
          useValue: entityManager,
        },
        {
          provide: MirrorNodeService,
          useValue: mirrorNodeService,
        },
        {
          provide: FanOutService,
          useValue: fanOutService,
        },
      ],
    }).compile();

    service = module.get<ReceiverService>(ReceiverService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('notifyGeneral', () => {
    it('should create a custom notification', async () => {
      const dto: NotifyGeneralDto = {
        userIds: [1, 2],
        type: NotificationType.TRANSACTION_CREATED,
        content: 'General notification content',
        entityId: 1,
        actorId: null,
      };

      entityManager.create.mockImplementation((_, data) => data);
      mockTransaction();

      await service.notifyGeneral(dto);

      expect(entityManager.create).toHaveBeenCalledWith(Notification, {
        type: dto.type,
        content: dto.content,
        entityId: dto.entityId,
        actorId: dto.actorId,
      });
      expect(entityManager.save).toHaveBeenNthCalledWith(1, Notification, {
        type: NotificationType.TRANSACTION_CREATED,
        content: 'General notification content',
        entityId: 1,
        actorId: null,
      });
      expect(entityManager.create).toHaveBeenCalledTimes(3); // 1 for notification, 2 for receivers
      expect(entityManager.create).toHaveBeenNthCalledWith(
        2,
        NotificationReceiver,
        expect.objectContaining({
          isEmailSent: null,
          isInAppNotified: null,
        }),
      );
      expect(entityManager.create).toHaveBeenNthCalledWith(
        3,
        NotificationReceiver,
        expect.objectContaining({
          isEmailSent: null,
          isInAppNotified: null,
        }),
      );
      expect(fanOutService.fanOut).toHaveBeenCalled();
    });
  });

  describe('notifyTransactionRequiredSigners', () => {
    it('should throw an error if transaction not found', async () => {
      entityManager.findOne.mockResolvedValueOnce(null);

      const dto: NotifyForTransactionDto = { transactionId: 1 };

      await expect(service.notifyTransactionRequiredSigners(dto)).rejects.toThrow(
        'Transaction not found',
      );
    });

    it('should notify required signers for a transaction', async () => {
      const dto: NotifyForTransactionDto = { transactionId: 1 };

      const transaction = {
        id: 1,
        transactionId: '0.0.215914@1618316800',
        creatorKey: { user: { id: 1 } },
      } as Transaction;
      entityManager.findOne.mockResolvedValueOnce(transaction);

      const keys = [{ userId: 2 }, { userId: 3 }] as UserKey[];
      jest.mocked(keysRequiredToSign).mockResolvedValueOnce(keys);

      entityManager.create.mockImplementation((_, data) => data);
      mockTransaction();

      await service.notifyTransactionRequiredSigners(dto);

      expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: dto.transactionId },
        relations: { creatorKey: { user: true } },
      });
      expect(entityManager.create).toHaveBeenNthCalledWith(1, Notification, {
        type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
        content: `A new transaction requires your review and signature. Please visit the Hedera Transaction Tool and locate the transaction using the following ID: ${transaction.transactionId}.`,
        entityId: transaction.id,
        actorId: null,
      });
      expect(entityManager.save).toHaveBeenNthCalledWith(1, Notification, {
        type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
        content: `A new transaction requires your review and signature. Please visit the Hedera Transaction Tool and locate the transaction using the following ID: ${transaction.transactionId}.`,
        entityId: 1,
        actorId: null,
      });
      expect(entityManager.create).toHaveBeenCalledTimes(6); // 2 for notification, 4 for receivers
      expect(entityManager.create).toHaveBeenNthCalledWith(
        1,
        Notification,
        expect.objectContaining({
          type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
          entityId: transaction.id,
        }),
      );
      expect(entityManager.create).toHaveBeenNthCalledWith(
        2,
        Notification,
        expect.objectContaining({
          type: NotificationType.TRANSACTION_INDICATOR_SIGN,
          entityId: transaction.id,
        }),
      );
      expect(entityManager.create).toHaveBeenNthCalledWith(
        3,
        NotificationReceiver,
        expect.objectContaining({
          isEmailSent: null,
          isInAppNotified: null,
        }),
      );
      expect(entityManager.create).toHaveBeenNthCalledWith(
        4,
        NotificationReceiver,
        expect.objectContaining({
          isEmailSent: null,
          isInAppNotified: null,
        }),
      );
      expect(fanOutService.fanOut).toHaveBeenCalled();
    });

    it('should throw an error if transaction not found', async () => {
      const dto: NotifyForTransactionDto = { transactionId: 1 };
      entityManager.findOne.mockResolvedValueOnce(null);

      await expect(service.notifyTransactionRequiredSigners(dto)).rejects.toThrow(
        'Transaction not found',
      );
    });
  });

  describe('notifyTransactionCreatorOnReadyForExecution', () => {
    it('should notify transaction creator when ready for execution', async () => {
      const dto: NotifyForTransactionDto = { transactionId: 1 };

      const transaction = {
        id: 1,
        creatorKey: { user: { id: 1 } },
      } as Transaction;
      entityManager.findOne.mockResolvedValueOnce(transaction);

      entityManager.create.mockImplementation((_, data) => data);
      mockTransaction();

      await service.notifyTransactionCreatorOnReadyForExecution(dto);

      expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: dto.transactionId },
        relations: { creatorKey: { user: true } },
      });
      expect(entityManager.create).toHaveBeenCalledWith(Notification, {
        type: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
        content: `Transaction ${transaction.transactionId} is ready for execution`,
        entityId: transaction.id,
        actorId: null,
      });
      expect(entityManager.save).toHaveBeenNthCalledWith(1, Notification, {
        type: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
        content: `Transaction ${transaction.transactionId} is ready for execution`,
        entityId: transaction.id,
        actorId: null,
      });
      expect(entityManager.create).toHaveBeenCalledTimes(4); // 2 for notification, 2 for receiver
      expect(entityManager.create).toHaveBeenNthCalledWith(
        1,
        Notification,
        expect.objectContaining({
          type: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
          entityId: transaction.id,
        }),
      );
      expect(entityManager.create).toHaveBeenNthCalledWith(
        2,
        Notification,
        expect.objectContaining({
          type: NotificationType.TRANSACTION_INDICATOR_EXECUTABLE,
          entityId: transaction.id,
        }),
      );
      expect(entityManager.create).toHaveBeenNthCalledWith(
        3,
        NotificationReceiver,
        expect.objectContaining({
          isEmailSent: null,
          isInAppNotified: null,
        }),
      );
      expect(fanOutService.fanOut).toHaveBeenCalled();
    });

    it('should throw an error if transaction not found', async () => {
      const dto: NotifyForTransactionDto = { transactionId: 1 };
      entityManager.findOne.mockResolvedValueOnce(null);

      await expect(service.notifyTransactionCreatorOnReadyForExecution(dto)).rejects.toThrow(
        'Transaction not found',
      );
    });
  });
});
