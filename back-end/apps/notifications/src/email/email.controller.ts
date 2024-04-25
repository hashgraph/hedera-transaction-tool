import { Controller } from '@nestjs/common';
import { EmailService } from './email.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotifyEmailDto, NotifyTransactionMembersDto } from './dtos';

@Controller()
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @EventPattern('notify_email')
  async notifyEmail(@Payload() payload: NotifyEmailDto) {
    return this.emailService.notifyEmail(payload);
  }

  @EventPattern('notify_transaction_members')
  async notifyTransactionMembers(@Payload() payload: NotifyTransactionMembersDto) {
    return this.emailService.notifyTransactionMembers(payload);
  }
}
