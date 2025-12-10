import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { connect, NatsConnection, JetStreamClient, JetStreamManager } from 'nats';

@Injectable()
export class NatsJetStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(NatsJetStreamService.name);

  private nc: NatsConnection;
  private js: JetStreamClient;
  private jsm: JetStreamManager;

  // Make this public so the factory can call it
  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    this.nc = await connect({
      servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
      name: 'nestjs-service',
      maxReconnectAttempts: -1,
      reconnectTimeWait: 1000,
    });

    this.js = this.nc.jetstream();
    this.jsm = await this.nc.jetstreamManager();

    this.logger.log(`Connected to NATS server: ${this.nc.getServer()}`);

    // Setup reconnection handlers
    (async () => {
      for await (const status of this.nc.status()) {
        this.logger.log(`NATS connection status: ${status.type} - ${status.data}`);
      }
    })();
  }

  getJetStream(): JetStreamClient {
    return this.js;
  }

  getManager(): JetStreamManager {
    return this.jsm;
  }

  async onModuleDestroy() {
    this.logger.log('Closing NATS connection');
    try {
      await this.nc.drain();
      await this.nc.close();
    } catch (err) {
      this.logger.error('Error closing NATS connection', err);
    }
  }
}