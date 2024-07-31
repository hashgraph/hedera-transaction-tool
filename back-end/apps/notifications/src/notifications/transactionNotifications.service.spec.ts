import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EntityManager, In } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import { MirrorNodeService, NotifyForTransactionDto } from '@app/common';
import { keysRequiredToSign } from '@app/common/utils';
import { Transaction, User, UserKey } from '@entities';

import { TransactionNotificationsService } from './transactionNotifications.service';
import { EmailService } from '../email/email.service';

jest.mock('@app/common/utils');

describe('Transaction Notifications Service', () => {
  let service: TransactionNotificationsService;
  const configService = mockDeep<ConfigService>();
  const emailService = mockDeep<EmailService>();
  const mirrorNodeService = mockDeep<MirrorNodeService>();
  const entityManager = mockDeep<EntityManager>();

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionNotificationsService,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: EmailService,
          useValue: emailService,
        },
        {
          provide: MirrorNodeService,
          useValue: mirrorNodeService,
        },
        {
          provide: EntityManager,
          useValue: entityManager,
        },
      ],
    }).compile();

    service = module.get<TransactionNotificationsService>(TransactionNotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('notifyTransactionRequiredSigners', () => {
    it('should throw an error if transaction not found', async () => {
      entityManager.findOne.mockResolvedValueOnce(null);

      const dto: NotifyForTransactionDto = { transactionId: 1 };

      await expect(service.notifyTransactionRequiredSigners(dto)).rejects.toThrow(
        'Transaction not found',
      );
    });

    it('should not send emails if no users found', async () => {
      const transaction = { id: 1, transactionId: '0x123' } as Transaction;
      entityManager.findOne.mockResolvedValueOnce(transaction);

      const keys = [{ userId: 1 }] as UserKey[];
      jest.mocked(keysRequiredToSign).mockResolvedValueOnce(keys);

      entityManager.find.mockResolvedValueOnce([]);

      const dto: NotifyForTransactionDto = { transactionId: 1 };

      await service.notifyTransactionRequiredSigners(dto);

      expect(emailService.notifyEmail).not.toHaveBeenCalled();
    });

    it('should send emails to users', async () => {
      const transaction = { id: 1, transactionId: '0x123' } as Transaction;
      entityManager.findOne.mockResolvedValueOnce(transaction);

      const keys = [{ userId: 1 }] as UserKey[];
      jest.mocked(keysRequiredToSign).mockResolvedValueOnce(keys);

      const users = [{ id: 1, email: 'user@example.com' }];
      entityManager.find.mockResolvedValueOnce(users);

      const dto: NotifyForTransactionDto = { transactionId: 1 };

      await service.notifyTransactionRequiredSigners(dto);

      expect(emailService.notifyEmail).toHaveBeenCalledWith({
        subject: 'Hedera Transaction Tool | Transaction to sign',
        email: ['user@example.com'],
        text: `You have a transaction to sign. Please visit the Hedera Transaction Tool to sign the transaction 0x123.`,
      });
    });

    it('should not send email to creator', async () => {
      const transaction = {
        id: 1,
        transactionId: '0x123',
        creatorKey: {
          user: { id: 1 },
        },
      } as Transaction;
      entityManager.findOne.mockResolvedValueOnce(transaction);

      const keys = [{ userId: 4 }, { userId: 1 }] as UserKey[];
      jest.mocked(keysRequiredToSign).mockResolvedValueOnce(keys);

      const users = [{ id: 4, email: 'user@example.com' }];
      entityManager.find.mockResolvedValueOnce(users);

      const dto: NotifyForTransactionDto = { transactionId: 1 };

      await service.notifyTransactionRequiredSigners(dto);

      expect(entityManager.find).toHaveBeenCalledWith(User, {
        where: {
          id: In([4]),
        },
        relations: {
          notificationPreferences: true,
        },
      });
      expect(emailService.notifyEmail).toHaveBeenCalledWith({
        subject: 'Hedera Transaction Tool | Transaction to sign',
        email: ['user@example.com'],
        text: `You have a transaction to sign. Please visit the Hedera Transaction Tool to sign the transaction 0x123.`,
      });
    });

    it('should not send email if user turned of his notifications for signatures', async () => {
      const transaction = { id: 1, transactionId: '0x123' } as Transaction;
      entityManager.findOne.mockResolvedValueOnce(transaction);

      const keys = [{ userId: 1 }] as UserKey[];
      jest.mocked(keysRequiredToSign).mockResolvedValueOnce(keys);

      const users = [
        {
          id: 1,
          email: 'user@example.com',
          notificationPreferences: {
            transactionRequiredSignature: false,
          },
        },
      ];
      entityManager.find.mockResolvedValueOnce(users);

      const dto: NotifyForTransactionDto = { transactionId: 1 };

      await service.notifyTransactionRequiredSigners(dto);

      expect(emailService.notifyEmail).not.toHaveBeenCalled();
    });
  });

  describe('notifyTransactionCreatorOnReadyForExecution', () => {
    it('should throw an error if transaction not found', async () => {
      entityManager.findOne.mockResolvedValueOnce(null);

      const dto: NotifyForTransactionDto = { transactionId: 1 };

      await expect(service.notifyTransactionCreatorOnReadyForExecution(dto)).rejects.toThrow(
        'Transaction not found',
      );
    });

    it('should throw an error if user not found', async () => {
      const transaction = {
        id: 1,
        transactionId: '0x123',
        creatorKey: { user: { id: 1 } },
      } as Transaction;
      entityManager.findOne.mockResolvedValueOnce(transaction);
      entityManager.findOne.mockResolvedValueOnce(null);

      const dto: NotifyForTransactionDto = { transactionId: 1 };

      await expect(service.notifyTransactionCreatorOnReadyForExecution(dto)).rejects.toThrow(
        'User not found',
      );
    });

    it('should send email to transaction creator', async () => {
      const transaction = {
        id: 1,
        transactionId: '0x123',
        creatorKey: { user: { id: 1 } },
      } as Transaction;
      const user = { id: 1, email: 'user@example.com' } as User;

      entityManager.findOne.mockResolvedValueOnce(transaction);
      entityManager.findOne.mockResolvedValueOnce(user);

      const dto: NotifyForTransactionDto = { transactionId: 1 };

      await service.notifyTransactionCreatorOnReadyForExecution(dto);

      expect(emailService.notifyEmail).toHaveBeenCalledWith({
        subject: 'Hedera Transaction Tool | Transaction ready for execution',
        email: 'user@example.com',
        text: `Your transaction 0x123 is ready for execution.`,
      });
    });

    it('should not send email if user turned of his notifications for ready for execution', async () => {
      const transaction = {
        id: 1,
        transactionId: '0x123',
        creatorKey: { user: { id: 1 } },
      } as Transaction;
      const user = {
        id: 1,
        email: 'user@example.com',
        notificationPreferences: {
          transactionReadyForExecution: false,
        },
      } as User;

      entityManager.findOne.mockResolvedValueOnce(transaction);
      entityManager.findOne.mockResolvedValueOnce(user);

      const dto: NotifyForTransactionDto = { transactionId: 1 };

      await service.notifyTransactionCreatorOnReadyForExecution(dto);

      expect(emailService.notifyEmail).not.toHaveBeenCalled();
    });
  });

  describe('filterByNotificationPreferences', () => {
    it('should return empty array if no users', () => {
      const users = [] as User[];
      const result = service.filterByNotificationPreferences(users, 'transactionReadyForExecution');

      expect(result).toEqual([]);
    });

    it('should return all users if no notification preferences', () => {
      const users = [{ id: 1 }, { id: 2 }] as User[];
      const result = service.filterByNotificationPreferences(users, 'transactionReadyForExecution');

      expect(result).toEqual(users);
    });

    it('should return only users with notification preferences', () => {
      const users = [
        { id: 1, notificationPreferences: { transactionReadyForExecution: true } },
        { id: 2, notificationPreferences: { transactionReadyForExecution: false } },
      ] as User[];
      const result = service.filterByNotificationPreferences(users, 'transactionReadyForExecution');

      expect(result).toEqual([users[0]]);
    });
  });
});
