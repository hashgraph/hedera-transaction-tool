import { Global, Module } from '@nestjs/common';

import { LoggerModule } from '@app/common';

import { EmailController } from './email.controller';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [LoggerModule],
  controllers: [EmailController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
