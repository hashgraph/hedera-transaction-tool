import { Controller } from '@nestjs/common';

import { Serialize } from '@app/common';

import { ExecuteService } from './execute.service';

import { TranasctionExecutedDto } from './dtos';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller('execute')
export class ExecuteController {
  constructor(private readonly executeService: ExecuteService) {}

  /* Execute a transaction */
  @MessagePattern('execute')
  @Serialize(TranasctionExecutedDto)
  async index(@Payload() transactionId: number) {
    return this.executeService.executeTransaction(transactionId);
  }
}
