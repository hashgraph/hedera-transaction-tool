import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import {
  NOTIFY_GENERAL,
  NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES,
  UPDATE_INDICATOR_NOTIFICATION,
  SYNC_SIGN_INDICATOR_NOTIFICATION,
  NotifyForTransactionDto,
  NotifyGeneralDto,
  UpdateIndicatorDto,
  SyncSignIndicatorNotificationDto,
} from '@app/common';

import { ReceiverService } from './receiver.service';

@Controller()
export class ReceiverController {
  constructor(private readonly receiverService: ReceiverService) {}

  @EventPattern(NOTIFY_GENERAL)
  async notifyGeneral(@Payload() payload: NotifyGeneralDto) {
    return this.receiverService.notifyGeneral(payload);
  }

  @EventPattern(NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES)
  async notifyTransactionSigners(@Payload() payload: NotifyForTransactionDto) {
    return this.receiverService.notifyTransactionRequiredSigners(payload);
  }

  @EventPattern(UPDATE_INDICATOR_NOTIFICATION)
  async updateNewStatusIndicatorNotification(@Payload() payload: UpdateIndicatorDto) {
    return this.receiverService.updateNewStatusIndicatorNotification(payload);
  }

  @EventPattern(SYNC_SIGN_INDICATOR_NOTIFICATION)
  async syncSignIndicatorNotification(
    @Payload() { transactionId }: SyncSignIndicatorNotificationDto,
  ) {
    return this.receiverService.syncSignIndicators(transactionId, null);
  }
}
