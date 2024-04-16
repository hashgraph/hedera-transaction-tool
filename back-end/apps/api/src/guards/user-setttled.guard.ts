import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserStatus } from '@entities';
import { ALLOW_NOT_SETTLED_USER } from '../decorators';

@Injectable()
export class UserSettledGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const { user } = context.switchToHttp().getRequest();

    const allowNotSettledUser = this.reflector.get<boolean>(
      ALLOW_NOT_SETTLED_USER,
      context.getHandler(),
    );
    if (allowNotSettledUser) return true;

    return user.status === UserStatus.NONE;
  }
}
