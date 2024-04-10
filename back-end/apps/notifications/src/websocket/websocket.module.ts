import { Module } from '@nestjs/common';
import { LoggerModule } from '@app/common';
import { WebsocketController } from './websocket.controller';

@Module({
  imports: [LoggerModule],
  providers: [ ],
  controllers: [WebsocketController],
})
export class WebsocketModule {}
