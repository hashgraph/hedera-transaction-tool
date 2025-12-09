import { Global, Module } from '@nestjs/common';

import { LoggerModule, NatsModule } from '@app/common';

import { EmailService } from './email.service';
import { EmailConsumerService } from './email-consumer.service';

@Global()
@Module({
  imports: [LoggerModule, NatsModule],
  providers: [EmailService, EmailConsumerService],
  exports: [EmailService],
})
export class EmailModule {}
