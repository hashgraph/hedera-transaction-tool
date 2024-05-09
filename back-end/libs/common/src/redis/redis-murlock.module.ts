import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MurLockModule } from 'murlock';

@Module({
  imports: [
    MurLockModule.forRootAsync({
      imports: [],
      useFactory: async (configService: ConfigService) => ({
        redisOptions: {
          url: configService.getOrThrow('REDIS_URL'),
        },
        wait: 2000,
        maxAttempts: 5,
        logLevel: 'log',
        ignoreUnlockFail: true,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class RedisMurlockModule {}
