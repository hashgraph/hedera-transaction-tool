import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { UserStatus } from '@entities';

@Injectable()
export class UserSettledGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const { user } = context.switchToHttp().getRequest();
    return user.status === UserStatus.NONE;
  }
}
