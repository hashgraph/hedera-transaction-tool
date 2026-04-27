import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { connect, NatsConnection, JetStreamClient, JetStreamManager } from 'nats';

const CONNECTION_TIMEOUT_MS = 30_000;

@Injectable()
export class NatsJetStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(NatsJetStreamService.name);

  private nc: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;
  private connected = false;

  /**
   * Attempts to connect to NATS with a timeout.
   * If NATS is unreachable, the app continues booting (degraded mode)
   * and the NATS client retries in the background.
   */
  async onModuleInit() {
    await this.connectWithTimeout();
  }

  private async connectWithTimeout() {
    try {
      let timedOut = false;
      const connectionPromise = this.connect();
      connectionPromise.catch((err) => {
        if (timedOut) {
          this.logger.error(
            `Background NATS connection attempt failed after startup timeout: ${err.message}`,
          );
        }
      });

      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          reject(new Error(`NATS connection timed out after ${CONNECTION_TIMEOUT_MS}ms`));
        }, CONNECTION_TIMEOUT_MS);
      });

      try {
        await Promise.race([connectionPromise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      this.logger.error(
        `Failed to connect to NATS on startup: ${err.message}. ` +
          'Service will continue in degraded mode and retry in the background.',
      );
    }
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
    this.connected = true;

    this.logger.log(`Connected to NATS server: ${this.nc.getServer()}`);

    this.monitorConnectionStatus();
  }

  private monitorConnectionStatus() {
    if (!this.nc) return;

    (async () => {
      for await (const status of this.nc.status()) {
        this.logger.log(`NATS connection status: ${status.type} - ${status.data}`);

        if (status.type === 'disconnect' || status.type === 'error') {
          this.connected = false;
          this.logger.warn('NATS connection lost');
        }

        if (status.type === 'reconnect') {
          this.connected = true;
          this.logger.log('NATS connection restored');
        }
      }
    })();
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnection(): NatsConnection | null {
    return this.nc;
  }

  getJetStream(): JetStreamClient | null {
    return this.js;
  }

  getManager(): JetStreamManager | null {
    return this.jsm;
  }

  async onModuleDestroy() {
    this.logger.log('Closing NATS connection');
    this.connected = false;
    try {
      if (this.nc) {
        await this.nc.drain();
        await this.nc.close();
      }
    } catch (err) {
      this.logger.error('Error closing NATS connection', err);
    }
  }
}