import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';

import { Acked, decode, EXECUTE_TRANSACTION, ExecuteTransactionDto } from '@app/common';

import { ExecuteService } from './execute.service';

@Controller('execute')
export class ExecuteController {
  constructor(private readonly executeService: ExecuteService) {}

  @EventPattern(EXECUTE_TRANSACTION)
  @Acked()
  async executeTransaction(@Payload() payload: ExecuteTransactionDto, @Ctx() context: RmqContext) {
    if (typeof payload.transactionBytes === 'string') {
      payload.transactionBytes = decode(payload.transactionBytes);
    }

    await this.executeService.executeTransaction(payload);
  }
}
