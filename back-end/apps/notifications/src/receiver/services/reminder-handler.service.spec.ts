import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import {
  keysRequiredToSign,
  MirrorNodeService,
  SchedulerService,
  parseTransactionSignKey,
} from '@app/common';
import { Notification, NotificationType, Transaction, TransactionStatus, UserKey } from '@entities';

import { ReceiverService } from '../receiver.service';
import { ReminderHandlerService } from './reminder-handler.service';

jest.mock('@app/common');
jest.mock('murlock', () => {
  const original = jest.requireActual('murlock');
  return {
    ...original,
    MurLock: function MurLock() {
      return (target, propertyKey, descriptor) => {
        return descriptor;
      };
    },
  };
});

describe('ReminderHandlerService', () => {
  const entityManager = mockDeep<EntityManager>();
  const mirrorNodeService = mockDeep<MirrorNodeService>();
  const receiverService = mockDeep<ReceiverService>();
  const schedulerService = mockDeep<SchedulerService>();

  let module: TestingModule;
  let service: ReminderHandlerService;

  beforeEach(async () => {
    jest.resetAllMocks();

    module = await Test.createTestingModule({
      providers: [
        ReminderHandlerService,
        {
          provide: EntityManager,
          useValue: entityManager,
        },
        {
          provide: MirrorNodeService,
          useValue: mirrorNodeService,
        },
        {
          provide: ReceiverService,
          useValue: receiverService,
        },
        {
          provide: SchedulerService,
          useValue: schedulerService,
        },
      ],
    }).compile();

    service = module.get<ReminderHandlerService>(ReminderHandlerService);
    await module.init();
  });

  afterEach(async () => await module.close());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should add listener to scheduler service', () => {
      expect(schedulerService.addListener).toHaveBeenCalled();
    });
  });

  describe('handleTransactionReminder', () => {
    const transactionId = 123;
    const key = `transaction:${transactionId}`;
    const transaction = {
      id: transactionId,
      status: TransactionStatus.WAITING_FOR_SIGNATURES,
      creatorKey: { userId: 3 },
      validStart: new Date(),
      transactionId: '0.0.123-1234567890-123456',
    } as Partial<Transaction>;
    const notification = {
      entityId: transactionId,
      type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER,
    } as Notification;

    it('should not proceed if key is invalid', async () => {
      jest.mocked(parseTransactionSignKey).mockReturnValueOnce(null);

      await service.handleTransactionReminder(key);

      expect(entityManager.findOne).not.toHaveBeenCalled();
      expect(receiverService.notifyGeneral).not.toHaveBeenCalled();
    });

    it('should not proceed if transaction is not found', async () => {
      jest.mocked(parseTransactionSignKey).mockReturnValueOnce(transaction.id);
      entityManager.findOne.mockResolvedValueOnce(null);

      await service.handleTransactionReminder(key);

      expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: transactionId },
        relations: { creatorKey: true },
      });
      expect(receiverService.notifyGeneral).not.toHaveBeenCalled();
    });

    it('should not proceed if transaction is not waiting for signatures', async () => {
      jest.mocked(parseTransactionSignKey).mockReturnValueOnce(transaction.id);
      entityManager.findOne.mockResolvedValueOnce({
        ...transaction,
        status: TransactionStatus.EXECUTED,
      });

      await service.handleTransactionReminder(key);

      expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: transactionId },
        relations: { creatorKey: true },
      });
      expect(receiverService.notifyGeneral).not.toHaveBeenCalled();
    });

    it('should not proceed if reminder notification already exists', async () => {
      jest.mocked(parseTransactionSignKey).mockReturnValueOnce(transaction.id);
      entityManager.findOne.mockResolvedValueOnce(transaction);
      entityManager.findOne.mockResolvedValueOnce(notification);

      await service.handleTransactionReminder(key);

      expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: transactionId },
        relations: { creatorKey: true },
      });
      expect(entityManager.findOne).toHaveBeenCalledWith(Notification, {
        where: {
          entityId: transaction.id,
          type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER,
        },
      });
      expect(receiverService.notifyGeneral).not.toHaveBeenCalled();
    });

    it('should send reminder notification if conditions are met', async () => {
      jest.mocked(parseTransactionSignKey).mockReturnValueOnce(transaction.id);
      entityManager.findOne.mockResolvedValueOnce(transaction);
      entityManager.findOne.mockResolvedValueOnce(null);
      jest
        .mocked(keysRequiredToSign)
        .mockResolvedValueOnce([{ userId: 1 } as UserKey, { userId: 2 } as UserKey]);

      await service.handleTransactionReminder(key);

      expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: transactionId },
        relations: { creatorKey: true },
      });
      expect(entityManager.findOne).toHaveBeenCalledWith(Notification, {
        where: {
          entityId: transaction.id,
          type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER,
        },
      });
      expect(receiverService.notifyGeneral).toHaveBeenCalledWith({
        type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER,
        content: expect.any(String),
        entityId: transaction.id,
        actorId: null,
        userIds: [1, 2, 3],
      });
    });
  });
});
