import { Test, TestingModule } from '@nestjs/testing';
import { UserKeysService } from './user-keys.service';

describe('UserKeysService', () => {
  let service: UserKeysService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserKeysService],
    }).compile();

    service = module.get<UserKeysService>(UserKeysService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
