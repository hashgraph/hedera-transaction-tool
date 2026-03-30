import { Injectable, Logger } from '@nestjs/common';
import { NatsJetStreamService } from './nats-jetstream.service';
import { PubAck } from 'nats';

type PublishResult = { success: boolean; response: PubAck | any };

@Injectable()
export class NatsPublisherService {
  private readonly logger = new Logger(NatsPublisherService.name);

  constructor(private nats: NatsJetStreamService) {}

  /* Returns ack once Jetstream has the message, NOT when the message is processed */
  async publish(subject: string, payload: any): Promise<PublishResult> {
    const js = this.nats.getJetStream();

    if (!this.nats.isConnected() || !js) {
      this.logger.warn(
        `NATS not connected, cannot publish to: ${subject}. Message will be lost.`,
      );
      return {
        success: false,
        response: { name: 'ConnectionError', message: 'NATS not connected' },
      };
    }

    try {
      const ack = await js.publish(subject, this.encodePayload(payload));
      this.logger.debug(`Published to: ${subject}, seq: ${ack.seq}`);
      return { success: true, response: ack };
    } catch (err) {
      this.logger.warn(`Failed to publish to ${subject}: ${err.message}`);
      const normalized =
        err instanceof Error
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
