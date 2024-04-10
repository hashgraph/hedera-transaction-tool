import { Controller } from '@nestjs/common';
import { EmailService } from './email.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotifyEmailDto } from './dto/notify-email.dto';

@Controller()
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @EventPattern('notify_email')
  async notifyEmail(@Payload() payload: NotifyEmailDto) {
    return this.emailService.notifyEmail(payload);
  }
}
