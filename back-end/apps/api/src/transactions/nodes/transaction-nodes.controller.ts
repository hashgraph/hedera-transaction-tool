import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Serialize } from '@app/common';
import { User } from '@entities';

import { JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../../guards';
import { TransactionNodeDto } from '../dto';
import { GetUser } from '../../decorators';
import { TransactionNodeCollection } from '../dto/ITransactionNode';
import { EnumValidationPipe } from '@app/common/pipes';
import { TransactionNodesService } from './transaction-nodes.service';

const TransactionNodeCollectionPipe = new EnumValidationPipe<TransactionNodeCollection>(
  TransactionNodeCollection,
  false,
);

@ApiTags('Transaction Nodes')
@Controller('transaction-nodes')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
export class TransactionNodesController {
  constructor(private readonly transactionNodesService: TransactionNodesService) {}

  @ApiOperation({
    summary: 'Get transaction nodes visible by the user',
    description: 'Get transaction nodes visible by the user',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionNodeDto],
  })
  @Serialize(TransactionNodeDto)
  @Get()
  getTransactionNodes(
    @GetUser() user: User,
    @Query('collection', TransactionNodeCollectionPipe) collection: TransactionNodeCollection,
  ): Promise<TransactionNodeDto[]> {
    return this.transactionNodesService.getTransactionNodes(user, collection);
  }
}
