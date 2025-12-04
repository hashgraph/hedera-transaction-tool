import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import {
  keysRequiredToSign,
  SchedulerService,
  parseTransactionSignKey,
  getRemindSignersDTO,
  emitTransactionRemindSigners,
  NatsPublisherService,
} from '@app/common';
import { Notification, NotificationType, Transaction, TransactionStatus, UserKey } from '@entities';

import { ReminderHandlerService } from './reminder-handler.service';

jest.mock('@app/common', () => {
  const original = jest.requireActual('@app/common');
  return {
    ...original,
    NatsModule: {
      forRoot: jest.fn().mockReturnValue({
        module: class MockNatsModule {
        },
        providers: [],
        exports: [],
      }),
    },
    parseTransactionSignKey: jest.fn(original.parseTransactionSignKey) as unknown,
    keysRequiredToSign: jest.fn(original.keysRequiredToSign) as unknown,
    getRemindSignersDTO: jest.fn(original.getRemindSignersDTO) as unknown,
    emitTransactionRemindSigners: jest.fn(original.emitTransactionRemindSigners) as unknown,
  };
});
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
  const schedulerService = mockDeep<SchedulerService>();
  const notificationsPublisher = mockDeep<NatsPublisherService>();

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
          provide: SchedulerService,
          useValue: schedulerService,
        },
        {
          provide: NatsPublisherService,
          useValue: notificationsPublisher,
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
      expect(emitTransactionRemindSigners).not.toHaveBeenCalled();
    });

    it('should not proceed if transaction is not found', async () => {
      jest.mocked(parseTransactionSignKey).mockReturnValueOnce(transaction.id);
      entityManager.findOne.mockResolvedValueOnce(null);

      await service.handleTransactionReminder(key);

      expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: transactionId },
        relations: { creatorKey: true },
      });
      expect(emitTransactionRemindSigners).not.toHaveBeenCalled();
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
      expect(emitTransactionRemindSigners).not.toHaveBeenCalled();
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
      expect(emitTransactionRemindSigners).not.toHaveBeenCalled();
    });

    it('should send reminder notification if conditions are met', async () => {
      jest.mocked(parseTransactionSignKey).mockReturnValueOnce(transaction.id);
      entityManager.findOne.mockResolvedValueOnce(transaction);
      entityManager.findOne.mockResolvedValueOnce(null);
      jest
        .mocked(keysRequiredToSign)
        .mockResolvedValueOnce([{ userId: 1 } as UserKey, { userId: 2 } as UserKey]);
      jest.mocked(getRemindSignersDTO).mockReturnValueOnce('remind-signers-dto' as any);

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
      expect(emitTransactionRemindSigners).toHaveBeenCalled();
    });
  });
});
