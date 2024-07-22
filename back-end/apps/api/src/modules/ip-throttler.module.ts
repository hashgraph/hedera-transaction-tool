import { Module } from '@nestjs/common';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        ({
          storage:
            new ThrottlerStorageRedisService(configService.getOrThrow('REDIS_URL')),
          throttlers: [
            {
              name: 'global-minute',
              ttl: seconds(60),
              limit: configService.getOrThrow<number>('GLOBAL_MINUTE_LIMIT'),
            },
            {
              name: 'global-second',
              ttl: seconds(1),
              limit: configService.getOrThrow<number>('GLOBAL_SECOND_LIMIT'),
            },
          ]
        }),
    }),
  ],
})
export class IpThrottlerModule {}