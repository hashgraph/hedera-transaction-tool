import { Inject, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModule, CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

import { redisStore } from 'cache-manager-redis-yet';
import type { RedisClientOptions } from 'redis';
@Module({
  imports: [
    CacheModule.registerAsync<RedisClientOptions>({
      isGlobal: true,
      useFactory: async (configService: ConfigService) => {
        return {
          store: await redisStore({
            url: configService.getOrThrow('REDIS_URL'),
            ttl:
              configService.get<number>('REDIS_DEFAULT_TTL_MS', { infer: true }) || 1 * 60 * 1_000,
          }),
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class RedisCacheModule {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  onModuleDestroy() {
    // @ts-expect-error client is not visible
    const client = this.cache.store.client;
    client.quit();
  }
}
