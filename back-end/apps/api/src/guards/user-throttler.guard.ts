/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { seconds, ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(ThrottlerStorage) storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(
      {
        throttlers: [
          {
            name: 'user-minute',
            ttl: seconds(60),
            limit: Number(configService.getOrThrow('USER_MINUTE_LIMIT')),
          },
          {
            name: 'user-second',
            ttl: seconds(1),
            limit: Number(configService.getOrThrow('USER_SECOND_LIMIT')),
          },
        ],
      },
      storageService,
      reflector,
    );
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user;
    if (!user) {
      throw new HttpException('No user connected.', HttpStatus.BAD_REQUEST);
    }
    return Promise.resolve(user.id);
  }
}
