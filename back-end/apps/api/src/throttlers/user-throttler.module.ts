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
        storage: new ThrottlerStorageRedisService(configService.getOrThrow('REDIS_URL')),
        throttlers: [
          {
            name: 'user-minute',
            ttl: seconds(60),
            limit: 100,
          },
          {
            name: 'user-second',
            ttl: seconds(1),
            limit: 10,
          },
        ],
      }),
    }),
  ],
})
export class UserThrottlerModule {}
