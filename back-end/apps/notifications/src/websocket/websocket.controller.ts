import { EventPattern, Payload } from '@nestjs/microservices';
import { Controller } from '@nestjs/common';

import { NOTIFY_CLIENT, NotifyClientDto } from '@app/common';

import { WebsocketGateway } from './websocket.gateway';

@Controller('websocket')
export class WebsocketController {
  constructor(private readonly websocketGateway: WebsocketGateway) {}

  //TODO Need to make sure that Rabbitmq is sending this out to all of them, not just one
  @EventPattern(NOTIFY_CLIENT)
  async notifyClient(@Payload() payload: NotifyClientDto) {
    return this.websocketGateway.notifyClient(payload);
  }
}
