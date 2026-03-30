import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NatsJetStreamService } from '@app/common/nats/nats-jetstream.service';
import { AckPolicy, Consumer, DeliverPolicy, JsMsg } from 'nats';
import { ClassConstructor } from 'class-transformer';
import { MessageValidator } from './message-validator.util';

const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

export interface ConsumerConfig {
  streamName: string;
  durableName: string;
  filterSubject?: string;
  filterSubjects?: string[];
  maxAckPending?: number;
  inactiveThreshold?: number;
  ackPolicy?: AckPolicy;
  deliverPolicy?: DeliverPolicy;
  maxMessages?: number;
}

export interface MessageHandler<T = any> {
  subject: string;
  handler: (data: T | T[]) => Promise<void>;
  dtoClass: ClassConstructor<T>;
}

export abstract class BaseNatsConsumerService implements OnModuleInit, OnModuleDestroy {
  protected consumer: Consumer | null = null;
  protected readonly logger: Logger;
  private consumePromise: Promise<void>;
  private running = true;
  private sleepAbort: (() => void) | null = null;

  constructor(
    protected readonly natsService: NatsJetStreamService,
    loggerContext: string,
  ) {
    this.logger = new Logger(loggerContext);
  }

  /**
   * Subclasses must provide consumer configuration
   */
  protected abstract getConsumerConfig(): ConsumerConfig;

  /**
   * Subclasses must provide message handlers
   */
  protected abstract getMessageHandlers(): MessageHandler[];

  async onModuleInit() {
    this.consumePromise = this.consumeWithReconnect();
  }

  /**
   * Main consume loop with automatic reconnection on failure.
   *
   * When NATS drops (for this consumer), the `for await` loop exits. This
   * outer while-loop catches the error, waits with exponential backoff,
   * recreates the consumer, and resumes consuming. JetStream will persist
   * and deliver, upon reconnection and within the 5-minute retention window,
   * any messages that were successfully published to NATS by other connected
   * clients during this consumer's outage; if publishers cannot reach NATS,
   * those messages cannot be persisted and will be lost.
   */
  private async consumeWithReconnect() {
    const config = this.getConsumerConfig();
    const handlers = this.getMessageHandlers();
    const handlerMap = new Map(handlers.map(h => [h.subject, h]));
    let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;

    while (this.running) {
      try {
        // Wait for NATS to be connected before attempting consumer creation
        await this.waitForConnection();

        if (!this.running) break;

        this.consumer = await this.createOrUpdateConsumer(
          config.streamName,
          {
            durable_name: config.durableName,
            ack_policy: config.ackPolicy ?? AckPolicy.Explicit,
            deliver_policy: config.deliverPolicy ?? DeliverPolicy.All,
            filter_subject: config.filterSubject,
            filter_subjects: config.filterSubjects,
            max_ack_pending: config.maxAckPending ?? 1000,
            inactive_threshold: config.inactiveThreshold ?? 600_000_000_000,
          },
        );

        // Reset delay on successful connection
        reconnectDelay = INITIAL_RECONNECT_DELAY_MS;

        this.logger.log('Consumer loop started');
        await this.startConsuming(config.maxMessages ?? 100, handlerMap);
        this.logger.log('Consumer loop ended');

        // Consumer exited normally (stream closed or idle timeout).
        // Brief delay before recreating to avoid a tight loop.
        await this.sleep(INITIAL_RECONNECT_DELAY_MS);
      } catch (error) {
        if (!this.running) break;

        this.logger.error(
          `Consumer error, reconnecting in ${reconnectDelay}ms: ${error.message}`,
          error.stack,
        );

        await this.sleep(reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      }
    }

    this.logger.log('Consumer loop stopped (shutdown)');
  }

  private async waitForConnection() {
    while (this.running && !this.natsService.isConnected()) {
      this.logger.warn('Waiting for NATS connection before starting consumer...');
      await this.sleep(2000);
    }
  }

  private async startConsuming(
    maxMessages: number,
    handlerMap: Map<string, MessageHandler>,
  ) {
    const messages = await this.consumer.consume({ max_messages: maxMessages });

    for await (const msg of messages) {
      if (!this.running) break;
      await this.processMessage(msg, handlerMap);
    }
  }

  private async processMessage(
    msg: JsMsg,
    handlerMap: Map<string, MessageHandler>,
  ) {
    try {
      const subject = msg.subject;
      const handler = handlerMap.get(subject);

      if (!handler) {
        this.logger.warn(`No handler for subject: ${subject}`);
        msg.ack();
        return;
      }

      const data = await MessageValidator.parseAndValidate(
        msg,
        handler.dtoClass,
        this.logger,
      );

      if (!data) {
        this.logger.warn(`Invalid message data on subject ${subject}, skipping`);
        msg.ack();
        return;
      }

      await handler.handler(data);
      msg.ack();
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`, error.stack);
      msg.ack(); // Still ack to avoid redelivery loops
    }
  }

  /* Consumer should not be deleted at this point, or may break other replicas */
  async onModuleDestroy() {
    this.logger.log('Shutting down consumer');
    this.running = false;

    // Wake up any pending sleep so the loop exits immediately
    if (this.sleepAbort) this.sleepAbort();

    if (this.consumePromise) {
      try {
        await this.consumePromise;
      } catch (error) {
        this.logger.error('Error closing consumer', error);
      }
    }
  }

  private async createOrUpdateConsumer(streamName: string, consumerConfig: any) {
    const jsm = this.natsService.getManager();
    const js = this.natsService.getJetStream();

    if (!jsm || !js) {
      throw new Error('NATS JetStream not available');
    }

    try {
      await jsm.consumers.info(streamName, consumerConfig.durable_name);
      this.logger.log(`Consumer ${consumerConfig.durable_name} already exists`);

      await jsm.consumers.update(streamName, consumerConfig.durable_name, consumerConfig);
      this.logger.log(`Consumer ${consumerConfig.durable_name} updated`);
    } catch (err) {
      if (err.message?.includes('consumer not found') || err.code === '404') {
        await jsm.consumers.add(streamName, consumerConfig);
        this.logger.log(`Consumer ${consumerConfig.durable_name} created`);
      } else {
        throw err;
      }
    }

    try {
      return await js.consumers.get(streamName, consumerConfig.durable_name);
    } catch (err) {
      this.logger.error(`Failed to get runtime consumer ${consumerConfig.durable_name}`, err?.stack);
      throw err;
    }
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
}
