import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExtractJwt } from 'passport-jwt';

import { IGNORE_CONTROLLER_GUARD } from '../decorators/ignore-controller-guard.decorator';

import { BlacklistService } from '../auth/blacklist.service';

export const extractJwtAuth = ExtractJwt.fromAuthHeaderAsBearerToken();
export const extractJwtOtp = ExtractJwt.fromHeader('otp');

export const JwtBlackListAuthGuard = createJwtBlacklistGuard(extractJwtAuth);
export const JwtBlackListOtpGuard = createJwtBlacklistGuard(extractJwtOtp);

export function createJwtBlacklistGuard(extractJwt: (req) => string) {
  @Injectable()
  class JwtBlacklistGuard implements CanActivate {
    constructor(
      public readonly reflector: Reflector,
      public readonly blacklistService: BlacklistService,
    ) {}

    async canActivate(context: ExecutionContext) {
      const ignoreControllerGuard = this.reflector.get<boolean>(
        IGNORE_CONTROLLER_GUARD,
        context.getHandler(),
      );
      if (ignoreControllerGuard) return true;

      const request = context.switchToHttp().getRequest();

      const jwt = extractJwt(request);
      if (!jwt) return false;

      const isBlacklisted = await this.blacklistService.isTokenBlacklisted(jwt);
      console.log('Is blacklisted:', isBlacklisted);

      return !isBlacklisted;
    }
  }

  return JwtBlacklistGuard;
}
