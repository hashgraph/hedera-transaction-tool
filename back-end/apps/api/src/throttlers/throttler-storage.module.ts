import { Global, Module } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Redis } from 'ioredis';

import { REDIS_CLIENT, RedisClientModule } from '@app/common';

/**
 * Provides a single, shared Redis-backed ThrottlerStorage.
 *
 * The per-context throttler guards (Ip / Email / User) each define their own
 * throttler limits in their constructor and share this one storage instance.
 * Keys are namespaced by throttler name + tracker + handler, so sharing the
 * storage does not let the guards interfere with one another.
 *
 * Reuses the app's shared Redis connection (RedisClientModule) rather than
 * opening its own - ThrottlerStorageRedisService accepts an existing ioredis
 * connection and, when given one, doesn't try to close it on shutdown, so
 * RedisClientModule stays the sole owner of that connection's lifecycle.
 */
@Global()
@Module({
  imports: [RedisClientModule],
  providers: [
    {
      provide: ThrottlerStorage,
      useFactory: (redis: Redis) => new ThrottlerStorageRedisService(redis),
      inject: [REDIS_CLIENT],
    },
  ],
  exports: [ThrottlerStorage],
})
export class ThrottlerStorageModule {}
