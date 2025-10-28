import { Ctx, EventPattern, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Controller } from '@nestjs/common';

import { Acked, GET_PORT, NOTIFY_CLIENT, NotifyClientDto } from '@app/common';

import { WebsocketGateway } from './websocket.gateway';

@Controller('/ws/websocket')
export class WebsocketController {
  constructor(
    private readonly websocketGateway: WebsocketGateway,
    private readonly configService: ConfigService,
  ) {}

  @EventPattern(NOTIFY_CLIENT)
  @Acked()
  async notifyClient(@Payload() payload: NotifyClientDto, @Ctx() context: RmqContext) {
    await this.websocketGateway.notifyClient(payload);
  }

  @MessagePattern(GET_PORT)
  async getPort() {
    return this.configService.get<number>('HTTP_PORT');
  }
}
