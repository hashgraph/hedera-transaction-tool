import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Controller } from '@nestjs/common';

import { GET_PORT, NOTIFY_CLIENT, NotifyClientDto } from '@app/common';

import { WebsocketGateway } from './websocket.gateway';

@Controller('/ws/websocket')
export class WebsocketController {
  constructor(
    private readonly websocketGateway: WebsocketGateway,
    private readonly configService: ConfigService,
  ) {}

  //TODO Need to make sure that Rabbitmq is sending this out to all of them, not just one
  @EventPattern(NOTIFY_CLIENT)
  async notifyClient(@Payload() payload: NotifyClientDto) {
    return this.websocketGateway.notifyClient(payload);
  }

  @MessagePattern(GET_PORT)
  async getPort() {
    return this.configService.get<number>('HTTP_PORT');
  }
}
