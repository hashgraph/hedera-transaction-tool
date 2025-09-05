import { Redis } from 'ioredis';

// after creating a group of > 100, I see one of these for each account that needs to sign for each transaction
//https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.2673708
//which is toooooo many. so I can use a debouncer in front end, as well?
export class DebouncedNotificationBatcher<T = unknown> {
  private pubClient: Redis;
  private subClient: Redis;
  private readonly batchKeyPrefix: string;
  private readonly flushKeyPrefix: string;

  private readonly GLOBAL_KEY = '__global__';

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
    this.pubClient = new Redis(redisUrl);
    this.subClient = new Redis(redisUrl);
    // Subscribe to key expiry events
    this.subClient.subscribe('__keyevent@0__:expired');
    this.subClient.on('message', async (_channel, message) => {
      if (message.startsWith(this.batchKeyPrefix)) {
        await this.processExpiration(message, this.batchKeyPrefix);
      } else if (message.startsWith(this.flushKeyPrefix)) {
        await this.processExpiration(message, this.flushKeyPrefix);
      }
    });
  }

  /**
   * Processes the expiration of a key, flushing the batch if necessary.
   * Locks the key to prevent concurrent flushes for the same group.
   * This is called when a key expires, either a batch or flush key.
   *
   * @param message - The expired key message.
   * @param keyPrefix - The prefix of the key that expired (batch or flush).
   */
  private async processExpiration(message: string, keyPrefix: string): Promise<void> {
    const groupKey = message.slice(keyPrefix.length);
    const lockKey = `${keyPrefix}${groupKey}:lock`;
    const acquired = await this.pubClient.set(lockKey, '1', 'PX', 1000, 'NX');
    if (acquired) {
      await this.flush(groupKey === this.GLOBAL_KEY ? null : groupKey);
      await this.pubClient.del(lockKey);
    }
  }

  /**
   * Adds a message to the batch for the specified group key.
   * If the batch size exceeds the maximum, it flushes immediately.
   * If the flush key is set, it renews the expiration; otherwise, it sets a new flush key.
   *
   * @param message - The message to add to the batch.
   * @param groupKey - The group key for batching. If null, uses a global key.
   */
  async add(message: T, groupKey: string | number | null = null): Promise<void> {
    const groupKeyStr = groupKey === null ? this.GLOBAL_KEY : String(groupKey);
    const batchKey = `${this.batchKeyPrefix}${groupKeyStr}`;
    const flushKey = `${this.flushKeyPrefix}${groupKeyStr}`;

    // Add message to Redis list and set TTL for max flush delay
    const length = await this.pubClient.rpush(batchKey, JSON.stringify(message));
    if (length === 1) {
      await this.pubClient.pexpire(batchKey, this.maxFlushMS);
    }

    // If batch size reached, flush immediately, removing the flush key in the process
    if (length >= this.maxBatchSize) {
      await this.flush(groupKey);
      return;
    }

    // If flush key exists, renew expiration; otherwise, set it to trigger flush via keyevent
    const isFlushScheduled = await this.pubClient.get(flushKey);
    if (isFlushScheduled) {
      await this.pubClient.pexpire(flushKey, this.delayMs);
    } else {
      await this.pubClient.set(flushKey, '1', 'PX', this.delayMs);
    }
  }

  /**
   * Flushes the batch for the specified group key.
   * Deletes both the batch and flush keys, then calls the flush callback with the messages.
   *
   * @param groupKey - The group key for which to flush messages. If null, uses a global key.
   */
  async flush(groupKey: string | number | null): Promise<void> {
    const groupKeyStr = groupKey === null ? this.GLOBAL_KEY : String(groupKey);
    const batchKey = `${this.batchKeyPrefix}${groupKeyStr}`;
    const flushKey = `${this.flushKeyPrefix}${groupKeyStr}`;

    // Retrieve all messages for the group
    const messages = await this.pubClient.lrange(batchKey, 0, -1);
    if (!messages || messages.length === 0) {
      return;
    }

    // Clear both the batch and flush keys
    await this.pubClient.del(batchKey);
    await this.pubClient.del(flushKey);

    // Parse messages and call the flush callback
    const parsedMessages = messages.map((msg) => JSON.parse(msg));
    await this.flushCallback(groupKey, parsedMessages);
  }

  /**
   * Flushes all batches for all group keys.
   * Deletes all flush keys and processes each batch.
   */
  async flushAll(): Promise<void> {
    // Delete all flush keys
    const flushKeys = await this.pubClient.keys(`${this.flushKeyPrefix}*`);
    for (const key of flushKeys) {
      await this.pubClient.del(key);
    }
    // Flush all batches
    const batchKeys = await this.pubClient.keys(`${this.batchKeyPrefix}*`);
    for (const key of batchKeys) {
      const groupKey = key.slice(this.batchKeyPrefix.length);
      await this.flush(groupKey);
    }
  }

  /**
   * Destroys the batcher, cleaning up all keys and disconnecting from Redis.
   * This does not flush the remaining batches first.
   */
  async destroy(): Promise<void> {
    const batchKeys = await this.pubClient.keys(`${this.batchKeyPrefix}*`);
    for (const key of batchKeys) {
      await this.pubClient.del(key);
    }
    const flushKeys = await this.pubClient.keys(`${this.flushKeyPrefix}*`);
    for (const key of flushKeys) {
      await this.pubClient.del(key);
    }
    this.pubClient.disconnect();
    this.subClient.disconnect();
  }
}