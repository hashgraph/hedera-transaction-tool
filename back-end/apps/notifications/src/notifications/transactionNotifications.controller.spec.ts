import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { TransactionNotificationsController } from './transactionNotifications.controller';
import { TransactionNotificationsService } from './transactionNotifications.service';
import { NotifyForTransactionDto } from '@app/common';

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

  it('should invoke notify transaction required signer with correct params', async () => {
    const dto: NotifyForTransactionDto = {
      transactionId: 1,
    };

    await controller.notifyTransactionSigners(dto);

    expect(notificationsService.notifyTransactionRequiredSigners).toHaveBeenCalledWith(dto);
  });

  it('should invoke notify transaction required signer with correct params', async () => {
    const dto: NotifyForTransactionDto = {
      transactionId: 1,
    };

    await controller.notifyTransactionCreatorOnReadyForExecution(dto);

    expect(notificationsService.notifyTransactionCreatorOnReadyForExecution).toHaveBeenCalledWith(
      dto,
    );
  });
});
