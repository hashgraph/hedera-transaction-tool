import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Provides a single, shared ioredis connection to REDIS_URL for everything in
 * the importing app/process that needs one - e.g. BlacklistService,
 * OtpStoreService, and IpUniqueEmailGuard inject it directly, and
 * ThrottlerStorageModule hands it to ThrottlerStorageRedisService (which
 * accepts an existing connection instead of opening its own) - instead of
 * each independently opening its own connection to the same Redis instance.
 *
 * Safe to share across any consumer that only issues regular request/response
 * commands. Anything doing pub/sub (SUBSCRIBE locks a connection into
 * subscriber-only mode) or blocking commands (BLPOP and friends would stall
 * every other consumer sharing the connection) needs its own dedicated
 * connection instead - see SchedulerService's separate pubClient/subClient.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => new Redis(configService.getOrThrow('REDIS_URL')),
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisClientModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  onModuleDestroy() {
    this.client.quit();
  }
}
