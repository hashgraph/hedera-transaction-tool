import { Module } from '@nestjs/common';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { LoggerModule } from '@app/common';

@Module({
  imports: [LoggerModule],
  controllers: [EmailController],
  providers: [EmailService],
})
export class EmailModule {}
