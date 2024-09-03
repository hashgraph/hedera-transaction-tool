import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'anonymous-minute',
            ttl: seconds(60),
            limit: configService.getOrThrow<number>('ANONYMOUS_MINUTE_LIMIT'),
          },
          {
            name: 'anonymous-five-second',
            ttl: seconds(5),
            limit: configService.getOrThrow<number>('ANONYMOUS_FIVE_SECOND_LIMIT'),
          },
        ],
        storage: new ThrottlerStorageRedisService(configService.getOrThrow('REDIS_URL')),
      }),
    }),
  ],
})
export class EmailThrottlerModule {}
