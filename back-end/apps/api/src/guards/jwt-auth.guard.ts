import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

import { IGNORE_CONTROLLER_GUARD } from '../decorators';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Ignore the controller guard, if set
    const ignoreControllerGuard = this.reflector.get<boolean>(
      IGNORE_CONTROLLER_GUARD,
      context.getHandler(),
    );
    if (ignoreControllerGuard) return true;

    // Determine if the requirements are met for the super.canActivate
    return super.canActivate(context);
  }
}
