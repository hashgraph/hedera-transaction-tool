import { Test, TestingModule } from '@nestjs/testing';
import { ApproversService } from './approvers.service';

describe('ApproversService', () => {
  let service: ApproversService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApproversService],
    }).compile();

    service = module.get<ApproversService>(ApproversService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
