import { Test, TestingModule } from '@nestjs/testing';
import { ApproversController } from './approvers.controller';

describe('ApproversController', () => {
  let controller: ApproversController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApproversController],
    }).compile();

    controller = module.get<ApproversController>(ApproversController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
