import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { mockDeep } from 'jest-mock-extended';
import { ExtractJwt } from 'passport-jwt';

import { BlacklistService } from '../auth/blacklist.service';

import { extractJwtAuth, extractJwtOtp, createJwtBlacklistGuard } from './jwt-blacklist.guard';

describe('JwtBlacklistGuard', () => {
  let guard: InstanceType<ReturnType<typeof createJwtBlacklistGuard>>;
  let reflector: Reflector;
  let context: ExecutionContext;
  const blacklistService = mockDeep<BlacklistService>();

  beforeEach(() => {
    reflector = { get: jest.fn() } as unknown as Reflector;
    context = { switchToHttp: jest.fn(), getHandler: jest.fn() } as unknown as ExecutionContext;

    const mockRequest = {};
    jest.spyOn(context, 'switchToHttp').mockReturnValue({
      getRequest: () => mockRequest,
    } as unknown as HttpArgumentsHost);
  });

  it('should allow access if IGNORE_CONTROLLER_GUARD is true', async () => {
    const JwtBlacklistGuard = createJwtBlacklistGuard(() => 'validToken');
    guard = new JwtBlacklistGuard(reflector, blacklistService);
    jest.spyOn(reflector, 'get').mockReturnValue(true);
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if no JWT is present', async () => {
    const JwtBlacklistGuard = createJwtBlacklistGuard(() => null);
    guard = new JwtBlacklistGuard(reflector, blacklistService);
    jest.spyOn(reflector, 'get').mockReturnValue(false);

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should deny access if the JWT is blacklisted', async () => {
    const JwtBlacklistGuard = createJwtBlacklistGuard(() => 'blacklistedToken');
    guard = new JwtBlacklistGuard(reflector, blacklistService);
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    blacklistService.isTokenBlacklisted.mockResolvedValue(true);

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should allow access if the JWT is not blacklisted', async () => {
    const JwtBlacklistGuard = createJwtBlacklistGuard(extractJwtAuth);
    guard = new JwtBlacklistGuard(reflector, blacklistService);
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    jest.spyOn(ExtractJwt, 'fromAuthHeaderAsBearerToken').mockReturnValue(() => 'valid token');
    blacklistService.isTokenBlacklisted.mockResolvedValue(false);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if no JWT is present in OTP header', async () => {
    const JwtBlacklistGuard = createJwtBlacklistGuard(extractJwtOtp);
    guard = new JwtBlacklistGuard(reflector, blacklistService);
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    jest.spyOn(ExtractJwt, 'fromHeader').mockReturnValue(() => null);

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should allow access if JWT is present in OTP header and not blacklisted', async () => {
    const JwtBlacklistGuard = createJwtBlacklistGuard(extractJwtOtp);
    guard = new JwtBlacklistGuard(reflector, blacklistService);
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    jest.spyOn(ExtractJwt, 'fromHeader').mockReturnValue(() => 'validToken');
    blacklistService.isTokenBlacklisted.mockResolvedValue(false);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if JWT is present in OTP header and blacklisted', async () => {
    const JwtBlacklistGuard = createJwtBlacklistGuard(extractJwtOtp);
    guard = new JwtBlacklistGuard(reflector, blacklistService);
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    jest.spyOn(ExtractJwt, 'fromHeader').mockReturnValue(() => 'blacklistedToken');
    blacklistService.isTokenBlacklisted.mockResolvedValue(true);

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });
});
