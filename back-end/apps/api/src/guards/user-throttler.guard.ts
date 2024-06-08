import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const req = context.switchToHttp().getRequest();

    if (!req.user) {
      throw new ForbiddenException('User not found.');
    }

    return super.generateKey(context, req.user.id, name);
  }
}