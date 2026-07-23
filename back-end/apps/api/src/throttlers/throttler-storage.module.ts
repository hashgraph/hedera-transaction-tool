import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

/**
 * Provides a single, shared Redis-backed ThrottlerStorage.
 *
 * The per-context throttler guards (Ip / Email / User) each define their own
 * throttler limits in their constructor and share this one storage instance.
 * Keys are namespaced by throttler name + tracker + handler, so sharing the
 * storage does not let the guards interfere with one another.
 */
@Global()
@Module({
  providers: [
    {
      provide: ThrottlerStorage,
      useFactory: (configService: ConfigService) =>
        new ThrottlerStorageRedisService(configService.getOrThrow('REDIS_URL')),
      inject: [ConfigService],
    },
  ],
  exports: [ThrottlerStorage],
})
export class ThrottlerStorageModule {}
