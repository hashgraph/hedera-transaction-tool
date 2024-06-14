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
              name: 'anon-minute',
              ttl: seconds(60),
              limit: 3,
            },
            {
              name: 'anon-second',
              ttl: seconds(1),
              limit: 1,
            },
          ]
        }),
    }),
  ],
})
export class EmailThrottlerModule {}