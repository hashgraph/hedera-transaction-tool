import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NatsJetStreamService } from './nats-jetstream.service';
import { JetStreamClient, PubAck } from 'nats';

type PublishResult = { success: boolean; response: PubAck | any };

@Injectable()
export class NatsPublisherService implements OnModuleInit {
  private readonly logger = new Logger(NatsPublisherService.name);
  private js: JetStreamClient;

  constructor(private nats: NatsJetStreamService) {}

  async onModuleInit() {
    this.js = this.nats.getJetStream();
  }

  /* Returns ack once Jetstream has the message, NOT when the message is processed */
  async publish(subject: string, payload: any): Promise<PublishResult> {
    try {
      const ack = await this.js.publish(subject, this.encodePayload(payload));
      this.logger.debug(`Published to: ${subject}, seq: ${ack.seq}`);
      return { success: true, response: ack };
    } catch (err) {
      this.logger.error(`Error publishing: ${subject}`, err);
      const normalized = err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : err;
      return { success: false, response: normalized };
    }
  }

  // Helper method to encode payload consistently
  private encodePayload(payload: any): Uint8Array {
    const jsonString = JSON.stringify(payload ?? {});
    return new TextEncoder().encode(jsonString);
  }
}