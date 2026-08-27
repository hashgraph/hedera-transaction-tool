/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { seconds, ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';

@Injectable()
export class EmailThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(ThrottlerStorage) storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(
      {
        throttlers: [
          {
            name: 'anonymous-minute',
            ttl: seconds(60),
            limit: Number(configService.get('ANONYMOUS_MINUTE_LIMIT', 3)),
          },
          {
            name: 'anonymous-five-second',
            ttl: seconds(5),
            limit: Number(configService.get('ANONYMOUS_FIVE_SECOND_LIMIT', 1)),
          },
        ],
      },
      storageService,
      reflector,
    );
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    // Falls back to the authenticated user's email for routes that don't carry it
    // in the body (e.g. /verify-reset, gated by the deprecated OTP JWT) - keeps
    // working unchanged once such a route's body carries the email directly.
    const email = req.body?.email ?? req.user?.email;
    if (!email) {
      throw new HttpException('No email specified.', HttpStatus.BAD_REQUEST);
    }
    return Promise.resolve(email);
  }
}
