import { Controller } from '@nestjs/common';

import { Serialize, TransactionExecutedDto } from '@app/common';

import { ExecuteService } from './execute.service';

import { MessagePattern, Payload } from '@nestjs/microservices';
import { ExecuteTransactionDto } from '@app/common/dtos/execute-transaction.dto';

@Controller('execute')
export class ExecuteController {
  constructor(private readonly executeService: ExecuteService) {}

  /* Execute a transaction */
  @MessagePattern('execute')
  @Serialize(TransactionExecutedDto)
  async index(@Payload() transaction: ExecuteTransactionDto) {
    return this.executeService.executeTransaction(transaction);
  }
}