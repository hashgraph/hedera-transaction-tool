import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserStatus } from '@entities';

import { ALLOW_NON_VERIFIED_USER } from '../decorators';

@Injectable()
export class VerifiedUserGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const { user } = context.switchToHttp().getRequest();

    const allowNonVerifiedUser = this.reflector.get<boolean>(
      ALLOW_NON_VERIFIED_USER,
      context.getHandler(),
    );
    if (allowNonVerifiedUser) return true;

    return user.status === UserStatus.NONE;
  }
}
