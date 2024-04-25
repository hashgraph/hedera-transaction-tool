import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { TransactionStatusService } from './transaction-status.service';

import { UpdateTransactionStatusDto } from './dto';

@Controller('transaction-status')
export class TransactionStatusController {
  constructor(private readonly transactionStatusService: TransactionStatusService) {}

  @EventPattern('update-transaction-status')
  async updateTransactionStatus(@Payload() payload: UpdateTransactionStatusDto) {
    return this.transactionStatusService.updateTransactionStatus(payload);
  }
}
