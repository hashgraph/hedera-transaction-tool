import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { User } from '@entities';

import { OtpJwtStrategy } from './otp-jwt.strategy';
import { UsersService } from '../../users/users.service';

describe('OtpJwtStrategy', () => {
  let strategy: OtpJwtStrategy;
  let usersService: UsersService;

  describe('OtpJwtStrategy with JWT_SECRET', () => {
    it('OtpJwtStrategy module should throw error when JWT_SECRET is unset', async () => {
      const mockUsersService = mockDeep<UsersService>();
      const mockConfigService = mockDeep<ConfigService>();
      const cb = async () =>
        await Test.createTestingModule({
          providers: [
            OtpJwtStrategy,
            { provide: UsersService, useValue: mockUsersService },
            { provide: ConfigService, useValue: mockConfigService },
          ],
        }).compile();
      await expect(cb()).rejects.toThrow(Error);
    });
  });

  describe('OtpJwtStrategy with JWT_SECRET', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OtpJwtStrategy,
          {
            provide: UsersService,
            useValue: {
              getUser: jest.fn(),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('secret'),
            },
          },
        ],
      }).compile();

      strategy = module.get<OtpJwtStrategy>(OtpJwtStrategy);
      usersService = module.get<UsersService>(UsersService);
    });

    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });

    it('should throw UnauthorizedException if verified is true', async () => {
      await expect(
        strategy.validate({ email: 'test@example.com', verified: true }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      jest.spyOn(usersService, 'getUser').mockResolvedValue(null);
      await expect(
        strategy.validate({ email: 'test@example.com', verified: false }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return user if verified is false and user exists', async () => {
      const user = { id: 1, email: 'test@example.com' };
      jest.spyOn(usersService, 'getUser').mockResolvedValue(user as User);
      await expect(
        strategy.validate({ email: 'test@example.com', verified: false }),
      ).resolves.toEqual(user);
    });
  });
});
