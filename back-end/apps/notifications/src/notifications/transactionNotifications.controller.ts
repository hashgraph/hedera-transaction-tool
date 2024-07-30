import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import {
  NOTIFY_TRANSACTION_CREATOR_ON_READY_FOR_EXECUTION,
  NOTIFY_TRANSACTION_REQUIRED_SIGNERS,
  NotifyForTransactionDto,
} from '@app/common';

import { TransactionNotificationsService } from './tranasctionNotifications.service';

@Controller()
export class TransactionNotificationsController {
  constructor(private readonly notificationsService: TransactionNotificationsService) {}

  @EventPattern(NOTIFY_TRANSACTION_REQUIRED_SIGNERS)
  async notifyTransactionSigners(@Payload() payload: NotifyForTransactionDto) {
    return this.notificationsService.notifyTransactionRequiredSigners(payload);
  }

  @EventPattern(NOTIFY_TRANSACTION_CREATOR_ON_READY_FOR_EXECUTION)
  async notifyTransactionCreatorOnReadyForExecution(@Payload() payload: NotifyForTransactionDto) {
    return this.notificationsService.notifyTransactionCreatorOnReadyForExecution(payload);
  }
}
