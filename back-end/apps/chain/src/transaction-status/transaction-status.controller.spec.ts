import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { UpdateTransactionStatusDto } from '@app/common';

import { TransactionStatusController } from './transaction-status.controller';
import { TransactionStatusService } from './transaction-status.service';

describe('TransactionStatusController', () => {
  let controller: TransactionStatusController;
  const transactionStatusService = mockDeep<TransactionStatusService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionStatusController],
      providers: [
        {
          provide: TransactionStatusService,
          useValue: transactionStatusService,
        },
      ],
    }).compile();

    controller = module.get<TransactionStatusController>(TransactionStatusController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should invoke update transaction status service', async () => {
    const payload: UpdateTransactionStatusDto = { id: 1 };

    await controller.updateTransactionStatus(payload);

    expect(transactionStatusService.updateTransactionStatus).toHaveBeenCalledWith({ id: 1 });
  });
});
