import { CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common';
import { UserKeysService } from '../user-keys/user-keys.service';

export class HasKeyGuard implements CanActivate {
  constructor(@Inject(UserKeysService) private readonly userKeysService: UserKeysService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();

    if (!req.user) {
      return false;
    }

    let keysCount = 0;
    try {
      keysCount = await this.userKeysService.getUserKeysCount(req.user.id);
    } catch (error) {
      return false;
    }

    if (keysCount > 0) {
      return true;
    } else {
      throw new ForbiddenException('You should have at least one key to perform this action.');
    }
  }
}
