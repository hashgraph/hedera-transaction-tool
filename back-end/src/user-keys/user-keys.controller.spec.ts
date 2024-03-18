import { Test, TestingModule } from '@nestjs/testing';
import { UserKeysController } from './user-keys.controller';

describe('UserKeysController', () => {
  let controller: UserKeysController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserKeysController],
    }).compile();

    controller = module.get<UserKeysController>(UserKeysController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
