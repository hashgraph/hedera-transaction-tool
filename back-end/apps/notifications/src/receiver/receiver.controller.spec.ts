import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { NotifyForTransactionDto } from '@app/common';

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

  it('should invoke notify transaction required signer with correct params', async () => {
    const dto: NotifyForTransactionDto = {
      transactionId: 1,
    };

    await controller.notifyTransactionSigners(dto);

    expect(receiverService.notifyTransactionRequiredSigners).toHaveBeenCalledWith(dto);
  });

  it('should invoke notify transaction required signer with correct params', async () => {
    const dto: NotifyForTransactionDto = {
      transactionId: 1,
    };

    await controller.notifyTransactionCreatorOnReadyForExecution(dto);

    expect(receiverService.notifyTransactionCreatorOnReadyForExecution).toHaveBeenCalledWith(dto);
  });
});
