import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { decode, EXECUTE_TRANSACTION, ExecuteTransactionDto } from '@app/common';

import { ExecuteService } from './execute.service';

@Controller('execute')
export class ExecuteController {
  constructor(private readonly executeService: ExecuteService) {}

  @EventPattern(EXECUTE_TRANSACTION)
  async updateExecute(@Payload() payload: ExecuteTransactionDto) {
    if (typeof payload.transactionBytes === 'string') {
      payload.transactionBytes = decode(payload.transactionBytes);
    }

    return this.executeService.executeTransaction(payload);
  }
}
