/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { seconds, ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';
import { extractClientIp } from '@app/common';

@Injectable()
export class IpResetPasswordThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(ThrottlerStorage) storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(
      {
        throttlers: [
          {
            name: 'reset-ip-minute',
            ttl: seconds(60),
            limit: Number(configService.get('RESET_IP_MINUTE_LIMIT', 5)),
          },
          {
            name: 'reset-ip-ten-second',
            ttl: seconds(10),
            limit: Number(configService.get('RESET_IP_TEN_SECOND_LIMIT', 1)),
          },
        ],
      },
      storageService,
      reflector,
    );
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    const clientIp = extractClientIp(req);
    if (!clientIp) {
      throw new HttpException('Unable to determine client IP', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return Promise.resolve(clientIp);
  }
}
