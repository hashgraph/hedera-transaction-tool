import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserStatus } from '@entities';

import { ALLOW_NONE_VERIFIED_USER } from '../decorators';

@Injectable()
export class VerifiedUserGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const { user } = context.switchToHttp().getRequest();

    const allowNoneVerifiedUser = this.reflector.get<boolean>(
      ALLOW_NONE_VERIFIED_USER,
      context.getHandler(),
    );
    if (allowNoneVerifiedUser) return true;

    return user.status === UserStatus.NONE;
  }
}
