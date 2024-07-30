import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { mockDeep } from 'jest-mock-extended';

import { TransactionNotificationsService } from './tranasctionNotifications.service';

jest.mock('nodemailer');

describe('Transaction Notifications Service', () => {
  let service: TransactionNotificationsService;
  const configService = mockDeep<ConfigService>();

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionNotificationsService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<TransactionNotificationsService>(TransactionNotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
