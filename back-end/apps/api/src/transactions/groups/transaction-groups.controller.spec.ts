import { Test, TestingModule } from '@nestjs/testing';
import { TransactionGroupsController } from './transaction-groups.controller';

describe('TransactionGroupsController', () => {
  let controller: TransactionGroupsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionGroupsController],
    }).compile();

    controller = module.get<TransactionGroupsController>(TransactionGroupsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
