import { Controller, Get } from '@nestjs/common';
import { NatsJetStreamService } from '@app/common/nats/nats-jetstream.service';

@Controller('/')
export class HealthController {
  constructor(private readonly natsService: NatsJetStreamService) {}

  @Get()
  health() {
    return {
      status: 'ok',
      nats: this.natsService.isConnected() ? 'connected' : 'disconnected',
    };
  }
}
