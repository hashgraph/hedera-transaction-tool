import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RetentionPolicy, StorageType } from 'nats';
import { NatsJetStreamService } from './nats-jetstream.service';

@Injectable()
export class NatsStreamInitializerService implements OnModuleInit {
  private readonly logger = new Logger(NatsStreamInitializerService.name);

  constructor(private nats: NatsJetStreamService) {}

  async onModuleInit() {
    // Wait a bit for NATS connection to be ready - is this needed?
    await new Promise(resolve => setTimeout(resolve, 100));
    await this.initializeStreams();
  }

  private async initializeStreams() {
    const jsm = await this.nats.getManager();

    try {
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
    } catch (err) {
      this.logger.error('Error initializing streams', err);
      throw err;
    }
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