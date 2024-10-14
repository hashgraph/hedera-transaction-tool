import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { UPDATE_TRANSACTION_STATUS, UpdateTransactionStatusDto } from '@app/common';

import { TransactionStatusService } from './transaction-status.service';

@Controller('transaction-status')
export class TransactionStatusController {
  constructor(private readonly transactionStatusService: TransactionStatusService) {}

  @EventPattern(UPDATE_TRANSACTION_STATUS)
  async updateTransactionStatus(@Payload() payload: UpdateTransactionStatusDto) {
    return this.transactionStatusService.updateTransactionStatus(payload);
  }
}
