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

  describe('blacklistPreviousUserTokens', () => {
    it('should store a per-user invalidation cutoff for the JWT lifetime', async () => {
      const expirationDays = 7;
      const expirationSeconds = expirationDays * 24 * 60 * 60;
      jest.spyOn(configService, 'get').mockReturnValue(expirationDays);
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

      await service.blacklistPreviousUserTokens(42);
      nowSpy.mockRestore();
      expect(client.set).toHaveBeenCalledWith(
        'blacklisted:user:42',
        '1700000000',
        'EX',
        expirationSeconds,
      );
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

    it('should reject a JWT issued before the user was removed', async () => {
      const jwt = createJwt({ userId: 42, iat: 1_700_000_000 });
      client.get.mockImplementation(async key =>
        key === 'blacklisted:user:42' ? '1700000001' : null,
      );

      await expect(service.isTokenBlacklisted(jwt)).resolves.toBe(true);
      expect(client.get).toHaveBeenCalledWith('blacklisted:user:42');
    });

    it('should not reject another user JWT', async () => {
      const jwt = createJwt({ userId: 43, iat: 1_700_000_000 });
      client.get.mockResolvedValue(null);

      await expect(service.isTokenBlacklisted(jwt)).resolves.toBe(false);
      expect(client.get).toHaveBeenCalledWith('blacklisted:user:43');
    });

    it('should allow a JWT issued after the invalidation cutoff', async () => {
      const jwt = createJwt({ userId: 42, iat: 1_700_000_002 });
      client.get.mockImplementation(async key =>
        key === 'blacklisted:user:42' ? '1700000001' : null,
      );

      await expect(service.isTokenBlacklisted(jwt)).resolves.toBe(false);
    });
  });
});

function createJwt(payload: object): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}
