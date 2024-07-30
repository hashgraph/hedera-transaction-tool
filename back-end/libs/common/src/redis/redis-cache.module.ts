import { Inject, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModule, CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        url: configService.getOrThrow('REDIS_URL'),
        no_ready_check: true,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class RedisCacheModule {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  onModuleDestroy() {
    // @ts-expect-error getClient is not visible
    const client = this.cache.store.getClient();
    client.quit();
  }
}
