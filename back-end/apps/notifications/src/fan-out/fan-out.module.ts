import { Module } from '@nestjs/common';

import { LoggerModule } from '@app/common';

import { EmailModule } from '../email/email.module';

import { FanOutService } from './fan-out.service';
import { InAppProcessorService } from '../in-app-processor/in-app-processor.service';

@Module({
  imports: [LoggerModule, EmailModule, InAppProcessorService],
  controllers: [],
  providers: [FanOutService],
  exports: [FanOutService],
})
export class FanOutModule {}
