import { Test, TestingModule } from '@nestjs/testing';
import { ExecuteController } from './execute.controller';

describe('ExecuteController', () => {
  let controller: ExecuteController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExecuteController],
    }).compile();

    controller = module.get<ExecuteController>(ExecuteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
