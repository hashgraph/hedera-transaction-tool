import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExtractJwt } from 'passport-jwt';

import { IGNORE_CONTROLLER_GUARD } from '../decorators';

import { BlacklistService } from '@app/common';

export const extractJwtAuth = ExtractJwt.fromAuthHeaderAsBearerToken();
export const extractJwtOtp = ExtractJwt.fromHeader('otp');

export const JwtBlackListAuthGuard = createJwtBlacklistGuard(extractJwtAuth);
export const JwtBlackListOtpGuard = createJwtBlacklistGuard(extractJwtOtp);

export function createJwtBlacklistGuard(extractJwt: (req: unknown) => string | null) {
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
      if (ignoreControllerGuard) {
        return true;
      }

      const request = context.switchToHttp().getRequest();

      let jwt: string | null;
      try {
        jwt = extractJwt(request);
      } catch {
        jwt = null;
      }

      if (!jwt) {
        // No token to check means nothing to blacklist - defer to the
        // auth guard that follows this one in the chain to reject the request.
        return true;
      }

      try {
        if (await this.blacklistService.isTokenBlacklisted(jwt)) {
          throw new UnauthorizedException();
        }
        return true;
      } catch {
        throw new UnauthorizedException();
      }
    }
  }

  return JwtBlacklistGuard;
}
