import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { ExecuteController } from './execute.controller';

import { ExecuteService } from './execute.service';

describe('ExecuteController', () => {
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

  it('should invoke the execute service with correct parameter', async () => {
    const transactionId = 1;

    await controller.index(transactionId);

    expect(executeService.executeTransaction).toHaveBeenCalledWith(transactionId);
  });
});
