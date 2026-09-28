import { RedisOptions } from 'ioredis';

/**
 * ioredis 6 switched several connection defaults (RESP3 by default, keep-alive
 * enabled, exponential retry backoff). This pins every ioredis client in the
 * app back to its ioredis 5 behavior so the 5->6 bump is version-only.
 */
export const LEGACY_IOREDIS_OPTIONS: RedisOptions = {
  protocol: 2,
  keepAlive: 0,
  retryStrategy: times => Math.min(times * 50, 2000),
};
