import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { NotifyForTransactionDto, NotifyGeneralDto } from '@app/common';
import { NotificationType } from '@entities';

import { ReceiverController } from './receiver.controller';
import { ReceiverService } from './receiver.service';

describe('Receiver Controller', () => {
  let controller: ReceiverController;
  const receiverService = mockDeep<ReceiverService>();

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ReceiverController],
      providers: [
        {
          provide: ReceiverService,
          useValue: receiverService,
        },
      ],
    }).compile();

    controller = app.get<ReceiverController>(ReceiverController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should invoke notifyGeneral with correct params', async () => {
    const dto: NotifyGeneralDto = {
      userIds: [1, 2],
      type: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
      content: 'General notification content',
      entityId: 1,
      actorId: 1,
    };

    await controller.notifyGeneral(dto);

    expect(receiverService.notifyGeneral).toHaveBeenCalledWith(dto);
  });

  it('should invoke notifyTransactionSigners with correct params', async () => {
    const dto: NotifyForTransactionDto = {
      transactionId: 1,
    };

    await controller.notifyTransactionSigners(dto);

    expect(receiverService.notifyTransactionRequiredSigners).toHaveBeenCalledWith(dto);
  });

  it('should invoke notifyTransactionCreatorOnReadyForExecution with correct params', async () => {
    const dto: NotifyForTransactionDto = {
      transactionId: 1,
    };

    await controller.notifyTransactionCreatorOnReadyForExecution(dto);

    expect(receiverService.notifyTransactionCreatorOnReadyForExecution).toHaveBeenCalledWith(dto);
  });
});
