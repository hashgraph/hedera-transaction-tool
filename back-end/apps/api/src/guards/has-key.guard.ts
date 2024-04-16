import { CanActivate, ExecutionContext, Inject, UnauthorizedException } from '@nestjs/common';
import { UserKeysService } from '../user-keys/user-keys.service';

export class HasKeyGuard implements CanActivate {
  constructor(@Inject(UserKeysService) private readonly userKeysService: UserKeysService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();

    if (!req.user) {
      return false;
    }

    try {
      const keysCount = await this.userKeysService.getUserKeysCount(req.user.id);
      console.log(keysCount);

      if (keysCount > 0) {
        return true;
      } else {
        throw new UnauthorizedException('You should have at least one key to perform this action.');
      }
    } catch (error) {
      console.log(error);

      return false;
    }
  }
}
