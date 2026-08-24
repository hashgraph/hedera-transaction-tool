import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extractClientIp } from '@app/common';
import { Redis } from 'ioredis';

const TEN_MINUTES_SECONDS = 600;

@Injectable()
export class IpResetPasswordUniqueEmailGuard implements CanActivate {
  private readonly redis: Redis;
  private readonly limit: number;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.redis = new Redis(configService.getOrThrow('REDIS_URL'));
    this.limit = Number(configService.get('RESET_IP_UNIQUE_EMAIL_LIMIT', 3));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const ip = extractClientIp(req);
    if (!ip) {
      throw new HttpException('Unable to determine client IP', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const email: string = req.body?.email;
    if (!email) return true; // let EmailThrottlerGuard handle the missing email case

    const key = `reset:ip-unique-email:${ip}`;

    // Check current unique email count before adding
    const countBefore = await this.redis.scard(key);
    if (countBefore >= this.limit) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Add email to the set and set TTL on first entry.
    // The 'NX' option sets the expiry only if one is not already present, preserving
    // the fixed 10-minute window. Requires Redis 7.0+.
    await this.redis.sadd(key, email);
    await this.redis.expire(key, TEN_MINUTES_SECONDS, 'NX');

    // Re-check after adding to handle concurrent requests
    const countAfter = await this.redis.scard(key);
    if (countAfter > this.limit) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
