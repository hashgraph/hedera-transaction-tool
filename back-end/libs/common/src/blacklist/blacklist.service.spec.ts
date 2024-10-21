import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { BlacklistService } from './blacklist.service';

jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => {
      return {
        set: jest.fn(),
        get: jest.fn(),
        quit: jest.fn(),
      };
    }),
  };
});

describe('BlacklistService', () => {
  let service: BlacklistService;
  let configService: ConfigService;
  let redisClient: jest.Mocked<Redis>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlacklistService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BlacklistService>(BlacklistService);
    configService = module.get<ConfigService>(ConfigService);
    redisClient = new Redis() as jest.Mocked<Redis>;
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
      jest.spyOn(service, 'withClient').mockImplementation(async callback => {
        return callback(redisClient);
      });

      await service.blacklistToken(jwt);

      expect(redisClient.set).toHaveBeenCalledWith(jwt, 'blacklisted', 'EX', expirationSeconds);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true if the token is blacklisted', async () => {
      const jwt = 'testToken';

      jest.spyOn(service, 'withClient').mockImplementation(async callback => {
        redisClient.get.mockResolvedValue('blacklisted');
        return callback(redisClient);
      });

      const result = await service.isTokenBlacklisted(jwt);

      expect(result).toBe(true);
      expect(redisClient.get).toHaveBeenCalledWith(jwt);
    });

    it('should return false if the token is not blacklisted', async () => {
      const jwt = 'testToken';

      jest.spyOn(service, 'withClient').mockImplementation(async callback => {
        redisClient.get.mockResolvedValue(null);
        return callback(redisClient);
      });

      const result = await service.isTokenBlacklisted(jwt);

      expect(result).toBe(false);
      expect(redisClient.get).toHaveBeenCalledWith(jwt);
    });
  });

  describe('withClient', () => {
    it('should handle errors gracefully', async () => {
      const callback = jest.fn().mockRejectedValue(new Error('Test error'));
      await expect(service.withClient(callback)).rejects.toThrow('Test error');
    });
  });
});
