import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { NotifyForTransactionDto, NotifyGeneralDto, SyncIndicatorsDto } from '@app/common';
import { NotificationType, TransactionStatus } from '@entities';

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
      additionalData: { network: 'testnet' },
    };

    await controller.notifyGeneral(dto);

    expect(receiverService.notifyGeneral).toHaveBeenCalledWith(dto);
  });

  it('should invoke notifyTransactionSigners with correct params', async () => {
    const dto: NotifyForTransactionDto = {
      transactionId: 1,
      network: 'testnet',
    };

    await controller.notifyTransactionSigners(dto);

    expect(receiverService.notifyTransactionRequiredSigners).toHaveBeenCalledWith(dto);
  });

  it('should invoke syncIndicators with correct params', async () => {
    const dto: SyncIndicatorsDto = {
      transactionId: 1,
      transactionStatus: TransactionStatus.WAITING_FOR_EXECUTION,
      network: 'testnet',
    };

    await controller.syncIndicators(dto);

    expect(receiverService.syncIndicators).toHaveBeenCalledWith(dto);
  });
});
