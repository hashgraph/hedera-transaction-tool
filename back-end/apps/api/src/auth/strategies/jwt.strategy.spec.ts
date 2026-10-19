import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { User } from '@entities';

import { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';

const mockUsersService = mockDeep<UsersService>();
const mockConfigService = mockDeep<ConfigService>();

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;

  describe('JwtStrategy without JWT_SECRET',  () => {

    it('JwtStrategy module should throw error when JWT_SECRET is unset', async () => {
      const cb  = async () => await Test.createTestingModule({
        providers: [
          JwtStrategy,
          { provide: UsersService, useValue: mockUsersService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      await expect(cb()).rejects.toThrow(Error);
    });

  });

  describe('JwtStrategy with JWT_SECRET', () => {
    beforeEach(async () => {
      jest.resetAllMocks();

      mockConfigService.getOrThrow.mockReturnValue('secret');

      const module = await Test.createTestingModule({
        providers: [
          JwtStrategy,
          { provide: UsersService, useValue: mockUsersService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    });

    it('should return a user when validate is called with a valid userId', async () => {
      const user = { id: 1, email: 'test@test.com', credentialVersion: 0 };
      mockUsersService.getUser.mockResolvedValue(user as User);

      const result = await jwtStrategy.validate({ userId: user.id, email: user.email, credentialVersion: undefined });
      expect(result).toEqual(user);
    });

    it.each([
      {
        scenario: 'old-password login racing the password save',
        tokenVersion: 0,
        currentVersion: 1,
      },
      {
        scenario: 'login between two rotations in the same second',
        tokenVersion: 1,
        currentVersion: 2,
      },
    ])('should reject a token from $scenario', async ({ tokenVersion, currentVersion }) => {
      const user = {
        id: 42,
        email: 'test@test.com',
        credentialVersion: currentVersion,
      };
      mockUsersService.getUser.mockResolvedValue(user as User);

      await expect(
        jwtStrategy.validate({
          userId: 42,
          email: user.email,
          credentialVersion: tokenVersion,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when no user is found', async () => {
      mockUsersService.getUser.mockResolvedValue(null);

      await expect(jwtStrategy.validate({ userId: 13213, email: 'sdads' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when the token is older than the current JWT_EXPIRATION', async () => {
      const iat = 1_700_000_000;
      const expirationDays = 7;
      mockConfigService.get.mockReturnValue(expirationDays);
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValue((iat + expirationDays * 24 * 60 * 60 + 1) * 1000);

      await expect(
        jwtStrategy.validate({ userId: 1, email: 'test@test.com', iat }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockUsersService.getUser).not.toHaveBeenCalled();

      nowSpy.mockRestore();
    });

    it('should return a user when the token is within the current JWT_EXPIRATION', async () => {
      const iat = 1_700_000_000;
      const expirationDays = 7;
      const user = { id: 1, email: 'test@test.com', credentialVersion: 0 };
      mockConfigService.get.mockReturnValue(expirationDays);
      mockUsersService.getUser.mockResolvedValue(user as User);
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValue((iat + expirationDays * 24 * 60 * 60 - 1) * 1000);

      const result = await jwtStrategy.validate({ userId: user.id, email: user.email, iat });
      expect(result).toEqual(user);

      nowSpy.mockRestore();
    });
  });
});
