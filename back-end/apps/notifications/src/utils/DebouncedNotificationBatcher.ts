import { Redis } from 'ioredis';
// import { SafeMurLock } from '@app/common/decorators/safelock.decorator';

// this needs to follow the same pattern as the schedule and reminder-handler thing.
//   it should be cleaner that way. also that's how the lock was handled, the reminder-handler uses murlock'
// after creating a group of > 100, I see one of these for each account that needs to sign for each transaction
//https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.2673708
//which is toooooo many. so I can use a debouncer in front end, as well?
export class DebouncedNotificationBatcher<T = unknown> {
  private redis: Redis;
  private subRedis: Redis;
  private readonly batchKeyPrefix: string;
  private readonly flushKeyPrefix: string;

  constructor(
    private readonly flushCallback: (groupKey: string | number | null, messages: T[]) => Promise<void>,
    private readonly delayMs: number,
    private readonly maxBatchSize: number,
    private readonly maxFlushMS: number,
    private readonly redisUrl: string,
    private readonly instanceId: string = 'default-instance',
  ) {
    this.batchKeyPrefix = `${this.instanceId}:batch:`;
    this.flushKeyPrefix = `${this.instanceId}:flush:`;
    this.redis = new Redis(redisUrl);
    this.subRedis = new Redis(redisUrl);
    // Subscribe to key expiry events
    this.subRedis.subscribe('__keyevent@0__:expired');
    this.subRedis.on('message', async (_channel, message) => {
      // If multiple instances are running, only one should process the flush
      if (message.startsWith(this.batchKeyPrefix)) {
        const groupKey = message.slice(this.batchKeyPrefix.length);
        const lockKey = `${this.batchKeyPrefix}${groupKey}:lock`;
        // Attempt to acquire lock for 1000ms using the NX option
        const acquired = await this.redis.set(lockKey, '1', 'PX', 1000, 'NX');
        if (acquired) {
          await this.flush(groupKey);
          await this.redis.del(lockKey);
        }
      } else if (message.startsWith(this.flushKeyPrefix)) {
        const groupKey = message.slice(this.flushKeyPrefix.length);
        const lockKey = `${this.flushKeyPrefix}${groupKey}:lock`;
        // Attempt to acquire lock for 1000ms using the NX option
        const acquired = await this.redis.set(lockKey, '1', 'PX', 1000, 'NX');
        if (acquired) {
          await this.flush(groupKey);
          await this.redis.del(lockKey);
        }
      }
    });
  }
//if subredis only checks for flushkey, and not batchkey, then pexpire(batchkey) won't do anything, right?
  async add(message: T, groupKey: string | number | null = null): Promise<void> {
    const batchKey = `${this.batchKeyPrefix}${groupKey}`;
    const flushKey = `${this.flushKeyPrefix}${groupKey}`;

    // Add message to Redis list and set TTL for max flush delay
    await this.redis.rpush(batchKey, JSON.stringify(message));
    await this.redis.pexpire(batchKey, this.maxFlushMS);

    // If batch size reached, flush immediately and remove flush key
    const length = await this.redis.llen(batchKey);
    if (length >= this.maxBatchSize) {
      await this.flush(groupKey);
      return;
    }

    // If flush key exists, renew expiration; otherwise, set it to trigger flush via keyevent
    // I think i would rather take out hte pexpire on the batchkey, and just use the flushkey
    // which emeans I would need to store total time expired (might be tough to do across many instances)
    const isFlushScheduled = await this.redis.get(flushKey);
    if (isFlushScheduled) {
      await this.redis.pexpire(flushKey, this.delayMs);
    } else {
      await this.redis.set(flushKey, '1', 'PX', this.delayMs);
    }
  }

  //this would be cleaner, but it's not working
  // @SafeMurLock(5000, 'groupKey')
  async flush(groupKey: string | number | null): Promise<void> {
    const batchKey = `${this.batchKeyPrefix}${groupKey}`;
    const flushKey = `${this.flushKeyPrefix}${groupKey}`;

    // Retrieve all messages for the group
    const messages = await this.redis.lrange(batchKey, 0, -1);
    if (!messages || messages.length === 0) {
      return;
    }

    // Clear both the batch and flush keys
    await this.redis.del(batchKey);
    await this.redis.del(flushKey);

    // Parse messages and call the flush callback
    const parsedMessages = messages.map((msg) => JSON.parse(msg));
    await this.flushCallback(groupKey, parsedMessages);
  }

  async flushAll(): Promise<void> {
    // Delete all flush keys
    const flushKeys = await this.redis.keys(`${this.flushKeyPrefix}*`);
    for (const key of flushKeys) {
      await this.redis.del(key);
    }
    // Flush all batches
    const batchKeys = await this.redis.keys(`${this.batchKeyPrefix}*`);
    for (const key of batchKeys) {
      const groupKey = key.slice(this.batchKeyPrefix.length);
      await this.flush(groupKey);
    }
  }

  async destroy(): Promise<void> {
    const batchKeys = await this.redis.keys(`${this.batchKeyPrefix}*`);
    for (const key of batchKeys) {
      await this.redis.del(key);
    }
    const flushKeys = await this.redis.keys(`${this.flushKeyPrefix}*`);
    for (const key of flushKeys) {
      await this.redis.del(key);
    }
    this.redis.disconnect();
    this.subRedis.disconnect();
  }
}