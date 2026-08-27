import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CLIENT_IP_KEY } from '@app/common';
import { Redis } from 'ioredis';

const TEN_MINUTES_SECONDS = 600;

/*
 * Caps how many distinct emails a single IP can target across the whole password
 * reset flow (/reset-password and /verify-reset share this guard, and the Redis
 * key isn't route-scoped, so an attacker can't get a separate budget per route).
 */
@Injectable()
export class IpUniqueEmailGuard implements CanActivate {
  private readonly redis: Redis;
  private readonly limit: number;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.redis = new Redis(configService.getOrThrow('REDIS_URL'));

    const configuredLimit = Number(configService.get('RESET_IP_UNIQUE_EMAIL_LIMIT', 3));
    if (!Number.isFinite(configuredLimit) || configuredLimit <= 0) {
      // Fail fast: a non-numeric or non-positive value silently disables this guard
      // (every count comparison against NaN is false), so surface the misconfiguration
      // at startup instead of quietly running unprotected.
      throw new Error(
        `RESET_IP_UNIQUE_EMAIL_LIMIT must be a positive number, got: ${configService.get('RESET_IP_UNIQUE_EMAIL_LIMIT')}`,
      );
    }
    this.limit = configuredLimit;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Falls back to the authenticated user's email for routes that don't carry it
    // in the body (e.g. /verify-reset, gated by the deprecated OTP JWT). Once that
    // JWT flow is removed (see the @deprecated note on OtpJwtStrategy) every such
    // route's body will carry the email directly, and `?? req.user?.email` here
    // can be deleted along with it.
    const rawEmail = req.body?.email ?? req.user?.email;
    // Guards run before the DTO validation pipe, so req.body.email could be anything
    // JSON allows here -- require a real string before treating it as one. Casing and
    // surrounding whitespace shouldn't create separate "unique" emails either, so
    // normalize before using it as the Redis set member.
    if (typeof rawEmail !== 'string' || !rawEmail.trim()) return true; // let EmailThrottlerGuard/DTO validation handle it
    const email = rawEmail.trim().toLowerCase();

    // Set by ClientIpMiddleware; never touch a raw header or req.ip here directly.
    const key = `reset:ip-unique-email:${req[CLIENT_IP_KEY]}`;

    // Once this IP has tripped the cap below, the set is deliberately left over the
    // limit for the rest of the window -- so this cheap check lets us reject outright,
    // without adding anything, once we're already in that locked-out state. Without
    // it, a burst of distinct emails after tripping could keep growing the set for
    // the rest of the window.
    const countBefore = await this.redis.scard(key);
    if (countBefore > this.limit) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    // SADD + EXPIRE NX + SCARD run as one MULTI/EXEC block, which Redis executes as a
    // single atomic unit relative to every other client -- no other command for this
    // key can run in between, so two concurrent requests for the same IP can't both
    // slip past the count check.
    const results = await this.redis
      .multi()
      .sadd(key, email)
      .expire(key, TEN_MINUTES_SECONDS, 'NX')
      .scard(key)
      .exec();

    if (!results) {
      throw new Error('Redis transaction aborted while checking the unique-email limit');
    }

    const [[saddErr], [expireErr], [scardErr, count]] = results;
    if (saddErr || expireErr || scardErr) {
      throw saddErr || expireErr || scardErr;
    }

    // Deliberately don't remove the email that pushed the count over the limit: once
    // an IP has attempted more than `limit` distinct emails, it stays locked out --
    // every request, including a repeat of an already-used email -- until the window
    // (TEN_MINUTES_SECONDS from the first attempt) expires.
    if ((count as number) > this.limit) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
