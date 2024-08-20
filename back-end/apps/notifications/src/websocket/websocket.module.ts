import { Module } from '@nestjs/common';

import { LoggerModule } from '@app/common';

import { WebsocketController } from './websocket.controller';
import { WebsocketGateway } from './websocket.gateway';

@Module({
  imports: [LoggerModule],
  controllers: [WebsocketController],
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
