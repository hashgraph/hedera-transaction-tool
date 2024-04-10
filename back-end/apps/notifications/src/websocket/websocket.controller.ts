import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { WebsocketGateway } from './websocket.gateway';
import { NotifyClientDto } from './dto/notify-client.dto';

@Controller('websocket')
export class WebsocketController {
  constructor(private readonly websocketGateway: WebsocketGateway) {}

  @EventPattern('notify_client')
  async notifyEmail(@Payload() payload: NotifyClientDto) {
    return this.websocketGateway.notifyClient(payload);
  }
}
