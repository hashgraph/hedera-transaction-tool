import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { User, UserStatus } from '@entities';

import { ApiKeysService } from '../api-keys/api-keys.service';

import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtOrApiKeyGuard } from './jwt-or-api-key.guard';

describe('JwtOrApiKeyGuard', () => {
  let guard: JwtOrApiKeyGuard;
  let reflector: Reflector;

  const apiKeysService = mockDeep<ApiKeysService>();

  const user = { id: 1, status: UserStatus.NONE } as User;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        JwtOrApiKeyGuard,
        { provide: ApiKeysService, useValue: apiKeysService },
        { provide: Reflector, useValue: { get: jest.fn(), getAllAndOverride: jest.fn() } },
      ],
    }).compile();

    guard = module.get(JwtOrApiKeyGuard);
    reflector = module.get(Reflector);
  });

  function contextFor(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  describe('API key path', () => {
    it('rejects a key on a route not marked @AllowApiKey', async () => {
      const request = { method: 'GET', headers: { 'x-api-key': 'tt_abc_def' } };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(apiKeysService.validateApiKey).not.toHaveBeenCalled();
    });

    it('authenticates a GET request with a valid key on an @AllowApiKey route', async () => {
      const request = { method: 'GET', headers: { 'x-api-key': 'tt_abc_def' } };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      apiKeysService.validateApiKey.mockResolvedValue(user);

      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request).toHaveProperty('user', user);
    });

    it('rejects non-GET requests even with a valid key', async () => {
      const request = { method: 'POST', headers: { 'x-api-key': 'tt_abc_def' } };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(apiKeysService.validateApiKey).not.toHaveBeenCalled();
    });

    it('rejects an invalid key', async () => {
      const request = { method: 'GET', headers: { 'x-api-key': 'tt_abc_def' } };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      apiKeysService.validateApiKey.mockResolvedValue(null);

      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an empty key header instead of silently falling back to JWT', async () => {
      const request = { method: 'GET', headers: { 'x-api-key': '' } };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      apiKeysService.validateApiKey.mockResolvedValue(null);
      const superCanActivate = jest.spyOn(JwtAuthGuard.prototype, 'canActivate');

      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(superCanActivate).not.toHaveBeenCalled();
    });

    it('rejects a repeated header instead of using the first value', async () => {
      const request = { method: 'GET', headers: { 'x-api-key': ['tt_a', 'tt_b'] } };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(apiKeysService.validateApiKey).not.toHaveBeenCalled();
    });

    it('rejects a junk key alongside a valid Authorization header, without falling back to JWT', async () => {
      const request = {
        method: 'GET',
        headers: { 'x-api-key': 'tt_junk', authorization: 'Bearer valid-token' },
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      apiKeysService.validateApiKey.mockResolvedValue(null);
      const superCanActivate = jest.spyOn(JwtAuthGuard.prototype, 'canActivate');

      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(superCanActivate).not.toHaveBeenCalled();
    });

    it('ignores a present Authorization header entirely when an API key is used', async () => {
      const request = {
        method: 'GET',
        headers: { 'x-api-key': 'tt_abc_def', authorization: 'Bearer token' },
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      apiKeysService.validateApiKey.mockResolvedValue(user);
      const superCanActivate = jest.spyOn(JwtAuthGuard.prototype, 'canActivate');

      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(superCanActivate).not.toHaveBeenCalled();
    });
  });

  describe('JWT path', () => {
    it('delegates to JwtAuthGuard (passport "jwt" strategy) when no key header is present', async () => {
      const request = { method: 'GET', headers: {} };
      const context = contextFor(request);
      const superCanActivate = jest
        .spyOn(JwtAuthGuard.prototype, 'canActivate')
        .mockResolvedValue(true);

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(superCanActivate).toHaveBeenCalledWith(context);
    });

    it('propagates a rejection from JwtAuthGuard', async () => {
      const request = { method: 'GET', headers: {} };
      jest
        .spyOn(JwtAuthGuard.prototype, 'canActivate')
        .mockRejectedValue(new UnauthorizedException());

      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
