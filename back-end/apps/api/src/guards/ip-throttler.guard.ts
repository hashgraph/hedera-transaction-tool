/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { seconds, ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';

@Injectable()
export class IpThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(ThrottlerStorage) storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(
      {
        throttlers: [
          {
            name: 'global-minute',
            ttl: seconds(60),
            limit: configService.getOrThrow<number>('GLOBAL_MINUTE_LIMIT'),
          },
          {
            name: 'global-second',
            ttl: seconds(1),
            limit: configService.getOrThrow<number>('GLOBAL_SECOND_LIMIT'),
          },
        ],
      },
      storageService,
      reflector,
    );
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    const clientIp = req.headers['x-forwarded-for'] || req.ip;
    if (!clientIp) {
      throw new HttpException('Unable to determine client IP', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return clientIp;
  }
}
