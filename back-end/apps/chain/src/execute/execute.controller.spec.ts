import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { TransactionStatus } from '@entities';
import { ExecuteTransactionDto } from '@app/common';

import { ExecuteController } from './execute.controller';
import { ExecuteService } from './execute.service';

describe('ExecuteControllerController', () => {
  let controller: ExecuteController;
  const executeService = mockDeep<ExecuteService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExecuteController],
      providers: [
        {
          provide: ExecuteService,
          useValue: executeService,
        },
      ],
    }).compile();

    controller = module.get<ExecuteController>(ExecuteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should invoke execute transaction in execute service with Buffer', async () => {
    const payload: ExecuteTransactionDto = {
      id: 1,
      mirrorNetwork: 'testnet',
      validStart: new Date(),
      transactionBytes: Buffer.from('test'),
      status: TransactionStatus.WAITING_FOR_EXECUTION,
    };

    await controller.executeTransaction(payload);

    expect(executeService.executeTransaction).toHaveBeenCalledWith(payload);
  });

  it('should invoke execute transaction in execute service with Buffer', async () => {
    const payload: ExecuteTransactionDto = {
      id: 1,
      mirrorNetwork: 'testnet',
      validStart: new Date(),
      //@ts-expect-error support hex string
      transactionBytes: '0xabc',
      status: TransactionStatus.WAITING_FOR_EXECUTION,
    };

    await controller.executeTransaction(payload);

    expect(executeService.executeTransaction).toHaveBeenCalledWith({
      ...payload,
      transactionBytes: Buffer.from('abc', 'hex'),
    });
  });
});
