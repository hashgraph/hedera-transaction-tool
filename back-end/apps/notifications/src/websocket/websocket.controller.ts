import { EventPattern, Payload } from '@nestjs/microservices';
import { WebsocketGateway } from './websocket.gateway';
import { NotifyClientDto } from './dtos/notify-client.dto';
import { Controller } from '@nestjs/common';

@Controller('websocket')
export class WebsocketController {
  constructor(private readonly websocketGateway: WebsocketGateway) {}

  //TODO Need to make sure that Rabbitmq is sending this out to all of them, not just one
  @EventPattern('notify_client')
  async notifyClient(@Payload() payload: NotifyClientDto) {
    return this.websocketGateway.notifyClient(payload);
  }
}
