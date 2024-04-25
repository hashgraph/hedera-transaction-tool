import { Test, TestingModule } from '@nestjs/testing';
import { SignersService } from './signers.service';

describe('SignaturesService', () => {
  let service: SignersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SignersService],
    }).compile();

    service = module.get<SignersService>(SignersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
