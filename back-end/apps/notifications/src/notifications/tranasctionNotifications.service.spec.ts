import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import { MirrorNodeService, NotifyForTransactionDto } from '@app/common';
import { keysRequiredToSign } from '@app/common/utils';
import { Transaction, UserKey } from '@entities';

import { TransactionNotificationsService } from './tranasctionNotifications.service';
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

    const keys = [{ user: { id: 1 } }] as UserKey[];
    jest.mocked(keysRequiredToSign).mockResolvedValueOnce(keys);

    entityManager.find.mockResolvedValueOnce([]);

    const dto: NotifyForTransactionDto = { transactionId: 1 };

    await service.notifyTransactionRequiredSigners(dto);

    expect(emailService.notifyEmail).not.toHaveBeenCalled();
  });

  it('should send emails to users', async () => {
    const transaction = { id: 1, transactionId: '0x123' } as Transaction;
    entityManager.findOne.mockResolvedValueOnce(transaction);

    const keys = [{ user: { id: 1 } }] as UserKey[];
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
});
