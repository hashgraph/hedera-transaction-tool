import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { mockDeep } from 'jest-mock-extended';

import { BlacklistService } from './blacklist.service';

jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({})),
  };
});

describe('BlacklistService', () => {
  let service: BlacklistService;
  const configService = mockDeep<ConfigService>();
  const client = mockDeep<Redis>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlacklistService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<BlacklistService>(BlacklistService);
    service.client = client;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('blacklistToken', () => {
    it('should set the token in Redis with the correct expiration', async () => {
      const jwt = 'testToken';
      const expirationDays = 7;
      const expirationSeconds = expirationDays * 24 * 60 * 60;

      jest.spyOn(configService, 'get').mockReturnValue(expirationDays);

      await service.blacklistToken(jwt);

      expect(client.set).toHaveBeenCalledWith(jwt, 'blacklisted', 'EX', expirationSeconds);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true if the token is blacklisted', async () => {
      const jwt = 'testToken';

      client.get.mockResolvedValue('blacklisted');

      const result = await service.isTokenBlacklisted(jwt);

      expect(result).toBe(true);
      expect(client.get).toHaveBeenCalledWith(jwt);
    });

    it('should return false if the token is not blacklisted', async () => {
      const jwt = 'testToken';

      client.get.mockResolvedValue(null);

      const result = await service.isTokenBlacklisted(jwt);

      expect(result).toBe(false);
      expect(client.get).toHaveBeenCalledWith(jwt);
    });
  });
});
