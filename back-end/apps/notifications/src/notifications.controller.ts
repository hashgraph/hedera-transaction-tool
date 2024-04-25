import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { NotificationsService } from './notifications.service';
import { NotifyEmailDto, NotifyTransactionMembersDto } from './dto';

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @EventPattern('notify_email')
  async notifyEmail(@Payload() payload: NotifyEmailDto) {
    return this.notificationsService.notifyEmail(payload);
  }

  @EventPattern('notify_transaction_members')
  async notifyTransactionMembers(@Payload() payload: NotifyTransactionMembersDto) {
    return this.notificationsService.notifyTransactionMembers(payload);
  }
}
