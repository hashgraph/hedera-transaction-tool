import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Redis } from 'ioredis';

/* Atomically check-and-delete: only removes the key if its value still matches
 * the given hash, and reports whether it did. Doing the compare and the delete
 * as a single Redis-side operation closes a race where two concurrent verify
 * attempts could otherwise both read the same still-present hash before either
 * gets to delete it, letting the same code be redeemed twice. */
const CONSUME_IF_MATCH_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  redis.call("DEL", KEYS[1])
  return 1
else
  return 0
end
`;

/*
 * Stores the hash of the currently-pending OTP for each email, and tracks failed
 * verification attempts against it. The OTP itself is a single random value per
 * request - this is the sole record of it. There's no time-based derivation to
 * reason about: a code is valid exactly as long as its hash is still stored here,
 * and "burning" it is just deleting the key.
 */
@Injectable()
export class OtpStoreService implements OnModuleDestroy {
  private readonly FAILED_ATTEMPTS_PREFIX = 'otp:failed-attempts:';
  private readonly CODE_PREFIX = 'otp:code:';

  client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisURL = this.configService.get('REDIS_URL');
    this.client = new Redis(redisURL);
  }

  onModuleDestroy() {
    this.client.quit();
  }

  /* Increment the failed attempt count for the email, returning the new count. */
  async registerFailedAttempt(email: string, ttlSeconds: number): Promise<number> {
    const key = this.failedAttemptsKey(email);
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return count;
  }

  async resetFailedAttempts(email: string): Promise<void> {
    await this.client.del(this.failedAttemptsKey(email));
  }

  /* Store the hash of a newly-generated code, replacing whatever code (if any)
   * was already pending for this email. */
  async storeCodeHash(email: string, codeHash: Buffer, ttlSeconds: number): Promise<void> {
    await this.client.set(this.codeKey(email), codeHash.toString('hex'), 'EX', ttlSeconds);
  }

  /* Atomically checks whether the given hash matches the pending code and, if
   * so, deletes it - so it can never be redeemed twice, even by two requests
   * racing each other with the same correct code. Returns whether it matched. */
  async consumeCodeHashIfMatch(email: string, codeHash: Buffer): Promise<boolean> {
    const result = await this.client.eval(
      CONSUME_IF_MATCH_SCRIPT,
      1,
      this.codeKey(email),
      codeHash.toString('hex'),
    );
    return result === 1;
  }

  /* Burns the pending code unconditionally - correct or not, it can no longer
   * be verified. */
  async deleteCodeHash(email: string): Promise<void> {
    await this.client.del(this.codeKey(email));
  }

  private failedAttemptsKey(email: string): string {
    return `${this.FAILED_ATTEMPTS_PREFIX}${email}`;
  }

  private codeKey(email: string): string {
    return `${this.CODE_PREFIX}${email}`;
  }
}
