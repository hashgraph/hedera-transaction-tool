import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { mockDeep } from 'jest-mock-extended';

import { OtpStoreService } from './otp-store.service';

jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({})),
  };
});

describe('OtpStoreService', () => {
  let service: OtpStoreService;
  const configService = mockDeep<ConfigService>();
  const client = mockDeep<Redis>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpStoreService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<OtpStoreService>(OtpStoreService);
    service.client = client;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerFailedAttempt', () => {
    it('should increment the counter and set the TTL on the first attempt', async () => {
      client.incr.mockResolvedValue(1);

      const count = await service.registerFailedAttempt('test@email.com', 120);

      expect(count).toBe(1);
      expect(client.incr).toHaveBeenCalledWith('otp:failed-attempts:test@email.com');
      expect(client.expire).toHaveBeenCalledWith('otp:failed-attempts:test@email.com', 120);
    });

    it('should not reset the TTL on subsequent attempts', async () => {
      client.incr.mockResolvedValue(2);

      const count = await service.registerFailedAttempt('test@email.com', 120);

      expect(count).toBe(2);
      expect(client.expire).not.toHaveBeenCalled();
    });
  });

  describe('resetFailedAttempts', () => {
    it('should delete the counter key', async () => {
      await service.resetFailedAttempts('test@email.com');

      expect(client.del).toHaveBeenCalledWith('otp:failed-attempts:test@email.com');
    });
  });

  describe('consumeCodeHashIfMatch', () => {
    it('should return true and pass the hex-encoded hash and key to the atomic script', async () => {
      client.eval.mockResolvedValue(1);
      const hash = Buffer.from('abcd', 'hex');

      const result = await service.consumeCodeHashIfMatch('test@email.com', hash);

      expect(result).toBe(true);
      expect(client.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'otp:code:test@email.com',
        'abcd',
      );
    });

    it('should return false when the script reports no match', async () => {
      client.eval.mockResolvedValue(0);

      const result = await service.consumeCodeHashIfMatch(
        'test@email.com',
        Buffer.from('abcd', 'hex'),
      );

      expect(result).toBe(false);
    });
  });

  describe('storeCodeHash', () => {
    it('should store the hash with the given TTL', async () => {
      const hash = Buffer.from('abcd', 'hex');

      await service.storeCodeHash('test@email.com', hash, 120);

      expect(client.set).toHaveBeenCalledWith('otp:code:test@email.com', 'abcd', 'EX', 120);
    });
  });

  describe('deleteCodeHash', () => {
    it('should delete the code key', async () => {
      await service.deleteCodeHash('test@email.com');

      expect(client.del).toHaveBeenCalledWith('otp:code:test@email.com');
    });
  });
});
