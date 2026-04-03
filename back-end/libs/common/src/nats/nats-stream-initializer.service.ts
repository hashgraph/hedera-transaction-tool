import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RetentionPolicy, StorageType } from 'nats';
import { NatsJetStreamService } from './nats-jetstream.service';

const MAX_INIT_RETRIES = 5;
const INIT_RETRY_BASE_MS = 2000;

@Injectable()
export class NatsStreamInitializerService implements OnModuleInit {
  private readonly logger = new Logger(NatsStreamInitializerService.name);

  constructor(private nats: NatsJetStreamService) {}

  async onModuleInit() {
    await this.initializeWithRetry();
  }

  private async initializeWithRetry() {
    for (let attempt = 1; attempt <= MAX_INIT_RETRIES; attempt++) {
      if (!this.nats.isConnected()) {
        this.logger.warn(
          `NATS not connected, waiting before stream initialization (attempt ${attempt}/${MAX_INIT_RETRIES})`,
        );
        await new Promise(resolve =>
          setTimeout(resolve, INIT_RETRY_BASE_MS * attempt),
        );
        continue;
      }

      try {
        await this.initializeStreams();
        return;
      } catch (err) {
        this.logger.error(
          `Stream initialization failed (attempt ${attempt}/${MAX_INIT_RETRIES}): ${err.message}`,
        );

        if (attempt === MAX_INIT_RETRIES) {
          this.logger.error(
            'All stream initialization attempts exhausted. ' +
              'Streams may already exist from a previous boot. Continuing without crash.',
          );
          return;
        }

        await new Promise(resolve =>
          setTimeout(resolve, INIT_RETRY_BASE_MS * attempt),
        );
      }
    }
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