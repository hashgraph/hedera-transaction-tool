import { Module } from '@nestjs/common';

import { LoggerModule, NatsModule } from '@app/common';

import { EmailModule } from '../email/email.module';

import { FanOutService } from './fan-out.service';
import { WebsocketModule } from '../websocket/websocket.module';
import { FanOutConsumerService } from './fan-out-consumer.service';

@Module({
  imports: [LoggerModule, EmailModule, WebsocketModule, NatsModule],
  providers: [FanOutService, FanOutConsumerService],
  exports: [FanOutService],
})
export class FanOutModule {}
