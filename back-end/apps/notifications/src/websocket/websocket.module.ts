import { Module } from '@nestjs/common';

import { LoggerModule } from '@app/common';

import { WebsocketController } from './websocket.controller';
import { WebsocketGateway } from './websocket.gateway';

@Module({
  imports: [LoggerModule],
  providers: [WebsocketGateway],
  controllers: [WebsocketController],
})
export class WebsocketModule {}
