import { CanActivate, ExecutionContext } from '@nestjs/common';

export class CurrentUserGuard implements CanActivate {
  // This doesn't appear to be reusable in any other scenario, unless I force the
  // front end to supply additional parameters, left it in for now.
  constructor(private paramName: string) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const params = req.params;
    if (!req.user || !params) {
      return false;
    }
    return req.user.id === parseInt(params[this.paramName]);
  }
}
