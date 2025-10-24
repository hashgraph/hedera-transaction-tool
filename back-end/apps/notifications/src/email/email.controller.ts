import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { Acked, NOTIFY_EMAIL, NotifyEmailDto } from '@app/common';

import { EmailService } from './email.service';

@Controller()
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @EventPattern(NOTIFY_EMAIL)
  @Acked()
  async notifyEmail(@Payload() payload: NotifyEmailDto) {
    await this.emailService.notifyEmail(payload);
  }
}
