import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';

import {
  Acked,
  NOTIFY_GENERAL,
  NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES,
  NotifyForTransactionDto,
  NotifyGeneralDto,
  SYNC_INDICATORS,
  SyncIndicatorsDto,
} from '@app/common';

import { ReceiverService } from './receiver.service';

@Controller()
export class ReceiverController {
  constructor(private readonly receiverService: ReceiverService) {}

  @EventPattern(NOTIFY_GENERAL)
  @Acked()
  async notifyGeneral(@Payload() payload: NotifyGeneralDto, @Ctx() context: RmqContext) {
    await this.receiverService.notifyGeneral(payload);
  }

  @EventPattern(NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES)
  @Acked()
  async notifyTransactionSigners(@Payload() payload: NotifyForTransactionDto, @Ctx() context: RmqContext) {
    await this.receiverService.notifyTransactionRequiredSigners(payload);
  }

  @EventPattern(SYNC_INDICATORS)
  @Acked()
  async syncIndicators(@Payload() payload: SyncIndicatorsDto, @Ctx() context: RmqContext) {
    await this.receiverService.syncIndicators(payload);
  }
}
