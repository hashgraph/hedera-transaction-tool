import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

import { Serialize } from '@app/common';

import { ExecuteService } from './execute.service';

import { TranasctionExecutedDto } from './dtos';

@Controller('execute')
export class ExecuteController {
  constructor(private readonly executeService: ExecuteService) {}

  /* Execute a transaction */
  @ApiOperation({
    summary: 'Execute a transaction by its id in the database.',
    description: 'Tries to execute a transaction by its id in the database.',
  })
  @ApiResponse({
    status: 200,
    type: TranasctionExecutedDto,
  })
  @Get(':transactionId')
  @HttpCode(HttpStatus.OK)
  @Serialize(TranasctionExecutedDto)
  async index(@Param('transactionId', ParseIntPipe) transactionId: number) {
    return this.executeService.executeTransaction(transactionId);
  }
}
