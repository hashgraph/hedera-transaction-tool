import { createHash } from 'crypto';

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { mockDeep } from 'jest-mock-extended';

import { BlacklistService } from '@app/common';
import { REDIS_CLIENT } from '@app/common';

const hashKey = (jwt: string) =>
  `blacklisted:token:${createHash('sha256').update(jwt).digest('hex')}`;

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
        {
          provide: REDIS_CLIENT,
          useValue: client,
        },
      ],
    }).compile();

    service = module.get<BlacklistService>(BlacklistService);
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

      expect(client.set).toHaveBeenCalledWith(
        hashKey(jwt),
        'blacklisted',
        'EX',
        expirationSeconds,
      );
      expect(client.set).not.toHaveBeenCalledWith(jwt, expect.anything(), 'EX', expect.anything());
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

      client.get.mockImplementation(async key => (key === hashKey(jwt) ? 'blacklisted' : null));

      const result = await service.isTokenBlacklisted(jwt);

      expect(result).toBe(true);
    });

    it('should return true for a legacy raw-JWT blacklist entry', async () => {
      const jwt = 'testToken';

      client.get.mockImplementation(async key => (key === jwt ? 'blacklisted' : null));

      await expect(service.isTokenBlacklisted(jwt)).resolves.toBe(true);
    });

    it('should return false if the token is not blacklisted', async () => {
      const jwt = 'testToken';

      client.get.mockResolvedValue(null);

      const result = await service.isTokenBlacklisted(jwt);

      expect(result).toBe(false);
      expect(client.get).toHaveBeenCalledWith(hashKey(jwt));
    });

    it('should propagate Redis errors so callers fail closed', async () => {
      client.get.mockRejectedValue(new Error('redis down'));

      await expect(service.isTokenBlacklisted('testToken')).rejects.toThrow('redis down');
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
