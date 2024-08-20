import { Module } from '@nestjs/common';

import { LoggerModule } from '@app/common';

import { EmailModule } from '../email/email.module';

import { FanOutService } from './fan-out.service';

@Module({
  imports: [LoggerModule, EmailModule],
  controllers: [],
  providers: [FanOutService],
  exports: [FanOutService],
})
export class FanOutModule {}
