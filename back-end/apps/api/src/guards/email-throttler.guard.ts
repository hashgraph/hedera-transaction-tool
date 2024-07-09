import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class EmailThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const email = req.body.email;
    if (!email) {
      throw new HttpException('No email specified.', HttpStatus.BAD_REQUEST);
    }
    return email;
  }
}