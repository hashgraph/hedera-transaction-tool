import { CanActivate, HttpArgumentsHost } from '@nestjs/common/interfaces';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { mockDeep } from 'jest-mock-extended';

import { BlacklistService } from '@app/common';

import { createJwtBlacklistGuard, extractJwtAuth, extractJwtOtp } from './jwt-blacklist.guard';

jest.mock('passport-jwt', () => ({
  ExtractJwt: {
    fromAuthHeaderAsBearerToken: jest.fn(() => () => 'token'),
    fromHeader: jest.fn(() => () => 'token'),
  },
}));

describe('JwtBlacklistGuard', () => {
  let guard: CanActivate;
  let reflector: Reflector;
  let context: ExecutionContext;
  const blacklistService = mockDeep<BlacklistService>();

  beforeEach(() => {
    jest.resetAllMocks();

    reflector = { get: jest.fn() } as unknown as Reflector;
    context = { switchToHttp: jest.fn(), getHandler: jest.fn() } as unknown as ExecutionContext;

    const mockRequest = {};
    jest.spyOn(context, 'switchToHttp').mockReturnValue({
      getRequest: () => mockRequest,
    } as unknown as HttpArgumentsHost);
  });

  it('should allow access if IGNORE_CONTROLLER_GUARD is true', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(true);

    const JwtBlacklistGuard = createJwtBlacklistGuard(() => 'validToken');
    guard = new JwtBlacklistGuard(reflector, blacklistService);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if no JWT is present', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);

    const JwtBlacklistGuard = createJwtBlacklistGuard(() => null);
    guard = new JwtBlacklistGuard(reflector, blacklistService);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should deny access if the JWT is blacklisted', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    blacklistService.isTokenBlacklisted.mockResolvedValue(true);

    const JwtBlacklistGuard = createJwtBlacklistGuard(() => 'blacklistedToken');
    guard = new JwtBlacklistGuard(reflector, blacklistService);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should allow access if the JWT is not blacklisted', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    blacklistService.isTokenBlacklisted.mockResolvedValue(false);

    const JwtBlacklistGuard = createJwtBlacklistGuard(extractJwtAuth);
    guard = new JwtBlacklistGuard(reflector, blacklistService);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if no JWT is present in OTP header', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);

    const JwtBlacklistGuard = createJwtBlacklistGuard(() => null);
    guard = new JwtBlacklistGuard(reflector, blacklistService);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should allow access if JWT is present in OTP header and not blacklisted', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    blacklistService.isTokenBlacklisted.mockResolvedValue(false);

    const JwtBlacklistGuard = createJwtBlacklistGuard(extractJwtOtp);
    guard = new JwtBlacklistGuard(reflector, blacklistService);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if JWT is present in OTP header and blacklisted', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    blacklistService.isTokenBlacklisted.mockResolvedValue(true);

    const JwtBlacklistGuard = createJwtBlacklistGuard(extractJwtOtp);
    guard = new JwtBlacklistGuard(reflector, blacklistService);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should deny access if JWT extraction throws an error', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);

    const JwtBlacklistGuard = createJwtBlacklistGuard(() => {
      throw new Error('Extraction error');
    });
    guard = new JwtBlacklistGuard(reflector, blacklistService);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should handle unexpected errors gracefully', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    jest
      .spyOn(blacklistService, 'isTokenBlacklisted')
      .mockRejectedValue(new Error('Unexpected error'));

    const JwtBlacklistGuard = createJwtBlacklistGuard(() => 'validToken');
    guard = new JwtBlacklistGuard(reflector, blacklistService);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
