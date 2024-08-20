import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import {
  NOTIFY_GENERAL,
  NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES,
  SYNC_INDICATORS,
  NotifyForTransactionDto,
  NotifyGeneralDto,
  SyncIndicatorsDto,
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

  @EventPattern(SYNC_INDICATORS)
  async updateNewStatusIndicatorNotification(@Payload() payload: SyncIndicatorsDto) {
    await this.receiverService.syncIndicators(payload);
  }
}
