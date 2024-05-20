import { Test, TestingModule } from '@nestjs/testing';
import { TransactionGroupsService } from './transaction-groups.service';

describe('TransactionGroupsService', () => {
  let service: TransactionGroupsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionGroupsService],
    }).compile();

    service = module.get<TransactionGroupsService>(TransactionGroupsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
