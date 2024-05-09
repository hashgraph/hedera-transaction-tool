import { Controller } from '@nestjs/common';

import { Serialize, TransactionExecutedDto } from '@app/common';

import { ExecuteService } from './execute.service';

import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller('execute')
export class ExecuteController {
  constructor(private readonly executeService: ExecuteService) {}

  /* Execute a transaction */
  @MessagePattern('execute')
  @Serialize(TransactionExecutedDto)
  async index(@Payload() transactionId: number) {
    return this.executeService.executeTransaction(transactionId);
  }
}
