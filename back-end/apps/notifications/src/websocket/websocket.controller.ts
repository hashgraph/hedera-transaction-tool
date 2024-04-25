import { EventPattern, Payload } from '@nestjs/microservices';
import { WebsocketGateway } from './websocket.gateway';
import { NotifyClientDto } from './dtos/notify-client.dto';
import { Controller } from '@nestjs/common';

@Controller('websocket')
export class WebsocketController {
  constructor(private readonly websocketGateway: WebsocketGateway) {}

  @EventPattern('notify_client')
  async notifyClient(@Payload() payload: NotifyClientDto) {
    return this.websocketGateway.notifyClient(payload);
  }
}
