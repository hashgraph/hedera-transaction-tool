import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import {
  NOTIFY_GENERAL,
  NOTIFY_TRANSACTION_CREATOR_ON_READY_FOR_EXECUTION,
  NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES,
  NotifyForTransactionDto,
  NotifyGeneralDto,
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

  @EventPattern(NOTIFY_TRANSACTION_CREATOR_ON_READY_FOR_EXECUTION)
  async notifyTransactionCreatorOnReadyForExecution(@Payload() payload: NotifyForTransactionDto) {
    return this.receiverService.notifyTransactionCreatorOnReadyForExecution(payload);
  }
}
