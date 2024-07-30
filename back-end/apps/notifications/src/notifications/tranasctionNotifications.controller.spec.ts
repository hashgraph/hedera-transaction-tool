import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { TransactionNotificationsController } from './transactionNotifications.controller';
import { TransactionNotificationsService } from './tranasctionNotifications.service';

describe('Transaction Notifications Controller', () => {
  let controller: TransactionNotificationsController;
  const notificationsService = mockDeep<TransactionNotificationsService>();

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [TransactionNotificationsController],
      providers: [
        {
          provide: TransactionNotificationsService,
          useValue: notificationsService,
        },
      ],
    }).compile();

    controller = app.get<TransactionNotificationsController>(TransactionNotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
