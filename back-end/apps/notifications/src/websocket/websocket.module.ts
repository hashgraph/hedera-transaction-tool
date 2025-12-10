import { Module } from '@nestjs/common';

import { BlacklistModule, LoggerModule } from '@app/common';

import { WebsocketGateway } from './websocket.gateway';

@Module({
  imports: [LoggerModule, BlacklistModule],
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
