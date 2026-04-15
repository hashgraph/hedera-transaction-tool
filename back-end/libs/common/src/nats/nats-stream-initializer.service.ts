import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { RetentionPolicy, StorageType } from 'nats';
import { NatsJetStreamService } from './nats-jetstream.service';

const MAX_RETRY_DELAY_MS = 30_000;
const INITIAL_RETRY_DELAY_MS = 2_000;

@Injectable()
export class NatsStreamInitializerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsStreamInitializerService.name);
  private running = true;
  private sleepAbort: (() => void) | null = null;
  private initPromise: Promise<void>;

  constructor(private nats: NatsJetStreamService) {}

  async onModuleInit() {
    this.initPromise = this.initializeWithRetry().catch(err =>
      this.logger.error('Unexpected stream initialization failure', err instanceof Error ? err.stack : String(err)),
    );
  }

  async onModuleDestroy() {
    this.running = false;
    if (this.sleepAbort) this.sleepAbort();

    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (err) {
        this.logger.error('Error during stream initialization shutdown', err instanceof Error ? err.stack : String(err));
      }
    }
  }

  private async initializeWithRetry() {
    let attempt = 0;
    let retryDelay = INITIAL_RETRY_DELAY_MS;

    while (this.running) {
      attempt++;

      if (!this.nats.isConnected()) {
        this.logger.warn(
          `NATS not connected, waiting before stream initialization (attempt ${attempt})`,
        );
        await this.sleep(retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
        continue;
      }

      // Reset delay on successful connection (avoids stale 30s waits after reconnect)
      retryDelay = INITIAL_RETRY_DELAY_MS;

      try {
        await this.initializeStreams();
        return;
      } catch (err) {
        this.logger.error(
          `Stream initialization failed (attempt ${attempt}): ${err.message}`,
        );
        await this.sleep(retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
      }
    }

    this.logger.log('Stream initialization stopped (shutdown)');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.sleepAbort = null;
        resolve();
      }, ms);

      this.sleepAbort = () => {
        clearTimeout(timer);
        this.sleepAbort = null;
        resolve();
      };
    });
  }

  private async initializeStreams() {
    const jsm = this.nats.getManager();

    if (!jsm) {
      throw new Error('JetStream manager not available');
    }

    // Create NOTIFICATIONS_QUEUE stream
    await this.createOrUpdateStream(jsm, {
      name: 'NOTIFICATIONS_QUEUE',
      subjects: ['notifications.queue.>'],
      retention: RetentionPolicy.Limits,
      storage: StorageType.File,
      max_age: 5 * 60 * 1_000_000_000, // 5 minutes in nanoseconds
      max_msgs: -1,
      max_bytes: 1024 * 1024 * 1024, // 1 GB
      discard: 'old',
    });

    // Create NOTIFICATIONS_FAN_OUT stream
    await this.createOrUpdateStream(jsm, {
      name: 'NOTIFICATIONS_FAN_OUT',
      subjects: ['notifications.fan-out.>'],
      retention: RetentionPolicy.Limits,
      storage: StorageType.File,
      max_age: 5 * 60 * 1_000_000_000,
      max_msgs: -1,
      max_bytes: 1024 * 1024 * 1024,
      discard: 'old',
    });

    this.logger.log('All streams initialized successfully');
  }

  private async createOrUpdateStream(jsm: any, config: any) {
    try {
      await jsm.streams.info(config.name);
      this.logger.log(`Stream ${config.name} already exists`);

      // Update if needed
      await jsm.streams.update(config.name, config);
      this.logger.log(`Stream ${config.name} updated`);
    } catch (err) {
      if (err.message?.includes('stream not found') || err.code === '404') {
        await jsm.streams.add(config);
        this.logger.log(`Stream ${config.name} created`);
      } else {
        throw err;
      }
    }
  }
}