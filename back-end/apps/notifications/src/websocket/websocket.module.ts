import { Module } from '@nestjs/common';

import { BlacklistModule, LoggerModule } from '@app/common';

import { WebsocketController } from './websocket.controller';
import { WebsocketGateway } from './websocket.gateway';

@Module({
  imports: [LoggerModule, BlacklistModule],
  controllers: [WebsocketController],
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
