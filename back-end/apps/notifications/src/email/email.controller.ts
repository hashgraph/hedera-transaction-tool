import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { NOTIFY_EMAIL, NotifyEmailDto } from '@app/common';

import { EmailService } from './email.service';

@Controller()
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @EventPattern(NOTIFY_EMAIL)
  async notifyEmail(@Payload() payload: NotifyEmailDto) {
    return this.emailService.notifyEmail(payload);
  }
}
