import { Test, TestingModule } from '@nestjs/testing';
import { SignersController } from './signers.controller';

describe('SignaturesController', () => {
  let controller: SignersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SignersController],
    }).compile();

    controller = module.get<SignersController>(SignersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
