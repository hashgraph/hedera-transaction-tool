import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NatsJetStreamService } from '@app/common/nats/nats-jetstream.service';
import { AckPolicy, Consumer, DeliverPolicy, JsMsg } from 'nats';
import { ClassConstructor } from 'class-transformer';
import { MessageValidator } from './message-validator.util';

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
  protected consumer: Consumer;
  protected readonly logger: Logger;
  private consumePromise: Promise<void>;

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
    const config = this.getConsumerConfig();

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
      }
    );

    this.consumePromise = this.startConsuming(config.maxMessages ?? 100);
  }

  private async startConsuming(maxMessages: number) {
    const handlers = this.getMessageHandlers();
    const handlerMap = new Map(handlers.map(h => [h.subject, h]));

    try {
      const messages = await this.consumer.consume({ max_messages: maxMessages });

      for await (const msg of messages) {
        await this.processMessage(msg, handlerMap);
      }
    } catch (error) {
      this.logger.error(`Consumer loop error: ${error.message}`, error.stack);
    }
  }

  private async processMessage(
    msg: JsMsg,
    handlerMap: Map<string, MessageHandler>
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
        this.logger
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
      msg.ack(); // Still ack to avoid redelivery - adjust based on your needs
    }
  }

  /* Consumer should not be deleted at this point, or may break other replicas */
  async onModuleDestroy() {
    this.logger.log('Shutting down consumer');
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
}