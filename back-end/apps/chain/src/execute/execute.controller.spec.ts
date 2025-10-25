import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { TransactionStatus } from '@entities';
import { ExecuteTransactionDto } from '@app/common';

import { ExecuteController } from './execute.controller';
import { ExecuteService } from './execute.service';
import { RmqContext } from '@nestjs/microservices';

// jest.mock('@app/common', () => {
//   const actual = jest.requireActual('@app/common');
//   return {
//     ...actual,
//     Acked: () => () => {}, // mock decorator as a no-op
//   };
// });

describe('ExecuteControllerController', () => {
  let controller: ExecuteController;
  const executeService = mockDeep<ExecuteService>();

  const mockCtx = {
    getChannelRef: () => ({ ack: jest.fn() }),
    getMessage: () => ({ properties: { headers: {} } }),
  } as unknown as RmqContext;

  beforeEach(async () => {
    jest.clearAllMocks();

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

    await controller.executeTransaction(payload, mockCtx);

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

    await controller.executeTransaction(payload, mockCtx);

    expect(executeService.executeTransaction).toHaveBeenCalledWith(
      {
        ...payload,
        transactionBytes: Buffer.from('abc', 'hex'),
      },
    );
  });
});
