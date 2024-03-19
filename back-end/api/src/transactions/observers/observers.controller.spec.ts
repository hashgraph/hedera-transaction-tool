import { Test, TestingModule } from '@nestjs/testing';
import { ObserversController } from './observers.controller';

describe('ObserversController', () => {
  let controller: ObserversController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ObserversController],
    }).compile();

    controller = module.get<ObserversController>(ObserversController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
