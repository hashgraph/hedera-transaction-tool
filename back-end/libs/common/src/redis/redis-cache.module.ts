import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

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
export class RedisCacheModule {}
