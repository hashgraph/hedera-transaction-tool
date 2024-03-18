import { Test, TestingModule } from '@nestjs/testing';
import { ObserversService } from './observers.service';

describe('ObserversService', () => {
  let service: ObserversService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ObserversService],
    }).compile();

    service = module.get<ObserversService>(ObserversService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
