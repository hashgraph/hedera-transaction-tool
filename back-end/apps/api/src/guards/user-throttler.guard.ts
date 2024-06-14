import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user;
    if (!user) {
      throw new HttpException('No user connected.', HttpStatus.BAD_REQUEST);
    }
    // console.log('user id', user.id);
    return user.id;
  }
}