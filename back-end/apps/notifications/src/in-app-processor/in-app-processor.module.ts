import { Global, Module } from '@nestjs/common';

import { LoggerModule } from '@app/common';

import { WebsocketModule } from '../websocket/websocket.module';

import { InAppProcessorService } from './in-app-processor.service';

@Global()
@Module({
  imports: [LoggerModule, WebsocketModule],
  controllers: [],
  providers: [InAppProcessorService],
  exports: [InAppProcessorService],
})
export class InAppModule {}
