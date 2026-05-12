import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModule, CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

import { createKeyv } from '@keyv/redis';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: (configService: ConfigService) => ({
        stores: [createKeyv(configService.getOrThrow('REDIS_URL'))],
        ttl:
          configService.get<number>('REDIS_DEFAULT_TTL_MS', { infer: true }) || 1 * 60 * 1_000,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class RedisCacheModule implements OnModuleDestroy {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  onModuleDestroy() {
    return this.cache.disconnect();
  }
}
