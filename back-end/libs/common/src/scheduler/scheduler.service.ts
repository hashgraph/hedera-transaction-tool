import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Redis } from 'ioredis';

/**
 * @description This service is responsible for creating a reminder system using Redis.
 * @notice Redis keyspace notifications are disabled by default, make sure to enable it in the Redis configuration file.
 * @notice Redis will not publish the event on the exact time because of its passive & active expiration policy.
 *          - Passive: Redis will check the expiration time when the key is accessed.
 *          - Active: Each second, 10 times, Redis will check 20 randim keys to see if they are expired.
 *         This makes the reminder system delayed at scale
 */
@Injectable()
export class SchedulerService {
  SCHEDULE_PREFIX = 'schedule:';

  pubClient: Redis;
  subClient: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisURL = this.configService.get('REDIS_URL');

    this.pubClient = new Redis(redisURL);
    this.subClient = new Redis(redisURL);
    this.subClient.subscribe('__keyevent@0__:expired');
  }

  addListener(handler: (key: string) => void) {
    this.subClient.on('message', async (_channel, message) => {
      if (!message.startsWith(this.SCHEDULE_PREFIX)) {
        return;
      }
      const key = message.replace(this.SCHEDULE_PREFIX, '');

      await handler(key);
    });
  }

  async addReminder(key: string, date: Date) {
    key = `${this.SCHEDULE_PREFIX}${key}`;
    await this.pubClient.set(key, key, 'PXAT', date.getTime());
  }
}
