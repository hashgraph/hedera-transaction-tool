import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';

import { Acked, UPDATE_TRANSACTION_STATUS, UpdateTransactionStatusDto } from '@app/common';

import { TransactionStatusService } from './transaction-status.service';

@Controller('transaction-status')
export class TransactionStatusController {
  constructor(private readonly transactionStatusService: TransactionStatusService) {}

  @EventPattern(UPDATE_TRANSACTION_STATUS)
  @Acked()
  async updateTransactionStatus(@Payload() payload: UpdateTransactionStatusDto, @Ctx() context: RmqContext) {
    await this.transactionStatusService.updateTransactionStatus(payload);
  }
}
