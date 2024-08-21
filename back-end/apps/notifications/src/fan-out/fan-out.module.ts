import { Module } from '@nestjs/common';

import { LoggerModule } from '@app/common';

import { EmailModule } from '../email/email.module';
import { InAppModule } from '../in-app-processor/in-app-processor.module';

import { FanOutService } from './fan-out.service';

@Module({
  imports: [LoggerModule, EmailModule, InAppModule],
  controllers: [],
  providers: [FanOutService],
  exports: [FanOutService],
})
export class FanOutModule {}
