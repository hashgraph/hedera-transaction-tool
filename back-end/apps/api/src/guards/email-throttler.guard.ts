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
    const email = req.body.email;
    if (!email) {
      throw new HttpException('No email specified.', HttpStatus.BAD_REQUEST);
    }
    return Promise.resolve(email);
  }
}
